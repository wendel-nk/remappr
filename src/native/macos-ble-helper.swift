import CoreBluetooth
import Foundation

struct Endpoint: Codable {
    let adapterId: String
    let serviceUuid: String
    let charUuid: String
}

struct Configuration: Codable {
    let mode: String
    let deviceId: String?
    let endpoints: [Endpoint]
}

final class BleBridge: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    private let configuration: Configuration
    private let queue = DispatchQueue(label: "dev.remappr.ble-helper")
    private var central: CBCentralManager!
    private var peripheral: CBPeripheral?
    private var characteristic: CBCharacteristic?
    private var currentEndpointIndex = 0
    private var writeQueue: [Data] = []
    private var writeInProgress = false
    private var closing = false
    private let outputLock = NSLock()

    init(configuration: Configuration) {
        self.configuration = configuration
        super.init()
        central = CBCentralManager(delegate: self, queue: queue)
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        guard central.state == .poweredOn else {
            if central.state == .unsupported || central.state == .unauthorized || central.state == .poweredOff {
                fail("Bluetooth is unavailable (CoreBluetooth state \(central.state.rawValue))")
            }
            return
        }

        let services = configuration.endpoints.map { CBUUID(string: $0.serviceUuid) }
        let devices = central.retrieveConnectedPeripherals(withServices: services)

        if configuration.mode == "list" {
            let unique = Dictionary(grouping: devices, by: { $0.identifier }).compactMap { _, matches in
                matches.first.map { device in
                    [
                        "id": "corebluetooth:\(device.identifier.uuidString)",
                        "label": device.name ?? "BLE Device",
                    ]
                }
            }
            emit(["type": "devices", "devices": unique])
            Foundation.exit(EXIT_SUCCESS)
        }

        guard configuration.mode == "connect", let deviceId = configuration.deviceId else {
            fail("Invalid helper configuration")
            return
        }
        let rawId = deviceId.replacingOccurrences(of: "corebluetooth:", with: "")
        guard let device = devices.first(where: {
            $0.identifier.uuidString.caseInsensitiveCompare(rawId) == .orderedSame
        }) else {
            fail("The connected Bluetooth keyboard is no longer available")
            return
        }

        peripheral = device
        device.delegate = self
        central.connect(device)
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        peripheral.delegate = self
        peripheral.discoverServices(configuration.endpoints.map { CBUUID(string: $0.serviceUuid) })
    }

    func centralManager(
        _ central: CBCentralManager,
        didFailToConnect peripheral: CBPeripheral,
        error: Error?
    ) {
        fail(error?.localizedDescription ?? "CoreBluetooth failed to connect")
    }

    func centralManager(
        _ central: CBCentralManager,
        didDisconnectPeripheral peripheral: CBPeripheral,
        timestamp: CFAbsoluteTime,
        isReconnecting: Bool,
        error: Error?
    ) {
        emit([
            "type": closing ? "closed" : "disconnected",
            "error": error?.localizedDescription ?? "",
        ])
        let status = closing ? EXIT_SUCCESS : EXIT_FAILURE
        queue.asyncAfter(deadline: .now() + .milliseconds(100)) {
            Foundation.exit(status)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let error {
            fail(error.localizedDescription)
            return
        }
        currentEndpointIndex = 0
        discoverNextEndpoint(on: peripheral)
    }

    private func discoverNextEndpoint(on peripheral: CBPeripheral) {
        while currentEndpointIndex < configuration.endpoints.count {
            let endpoint = configuration.endpoints[currentEndpointIndex]
            if let service = peripheral.services?.first(where: {
                $0.uuid == CBUUID(string: endpoint.serviceUuid)
            }) {
                peripheral.discoverCharacteristics(
                    [CBUUID(string: endpoint.charUuid)],
                    for: service
                )
                return
            }
            currentEndpointIndex += 1
        }
        fail("The keyboard exposes no supported firmware configuration service")
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didDiscoverCharacteristicsFor service: CBService,
        error: Error?
    ) {
        if error == nil, currentEndpointIndex < configuration.endpoints.count {
            let endpoint = configuration.endpoints[currentEndpointIndex]
            if let found = service.characteristics?.first(where: {
                $0.uuid == CBUUID(string: endpoint.charUuid)
            }) {
                characteristic = found
                peripheral.setNotifyValue(true, for: found)
                return
            }
        }
        currentEndpointIndex += 1
        discoverNextEndpoint(on: peripheral)
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateNotificationStateFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        if let error {
            fail(error.localizedDescription)
            return
        }
        guard characteristic.isNotifying,
              currentEndpointIndex < configuration.endpoints.count else {
            fail("CoreBluetooth could not enable Studio notifications")
            return
        }
        let endpoint = configuration.endpoints[currentEndpointIndex]
        emit([
            "type": "ready",
            "label": peripheral.name ?? "BLE Device",
            "firmwareAdapterId": endpoint.adapterId,
        ])
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateValueFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        if let error {
            fail(error.localizedDescription)
            return
        }
        if let value = characteristic.value {
            emit(["type": "data", "data": value.base64EncodedString()])
        }
    }

    func peripheral(
        _ peripheral: CBPeripheral,
        didWriteValueFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        if let error {
            fail(error.localizedDescription)
            return
        }
        writeInProgress = false
        sendNextWrite()
    }

    func handleCommand(_ line: String) {
        queue.async { [weak self] in
            guard let self,
                  let data = line.data(using: .utf8),
                  let command = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let type = command["type"] as? String else { return }

            if type == "write",
               let encoded = command["data"] as? String,
               let bytes = Data(base64Encoded: encoded) {
                self.enqueueWrite(bytes)
            } else if type == "close" {
                self.close()
            }
        }
    }

    private func enqueueWrite(_ data: Data) {
        guard let peripheral else { return }
        let withResponse = characteristic?.properties.contains(.write) == true
        let writeType: CBCharacteristicWriteType = withResponse ? .withResponse : .withoutResponse
        let maximum = max(1, peripheral.maximumWriteValueLength(for: writeType))
        var offset = 0
        while offset < data.count {
            let end = min(offset + maximum, data.count)
            writeQueue.append(data.subdata(in: offset ..< end))
            offset = end
        }
        sendNextWrite()
    }

    private func sendNextWrite() {
        guard !writeInProgress,
              !writeQueue.isEmpty,
              let peripheral,
              let characteristic else { return }
        let data = writeQueue.removeFirst()
        let withResponse = characteristic.properties.contains(.write)
        writeInProgress = withResponse
        peripheral.writeValue(
            data,
            for: characteristic,
            type: withResponse ? .withResponse : .withoutResponse
        )
        if !withResponse {
            sendNextWrite()
        }
    }

    private func close() {
        closing = true
        guard let peripheral else {
            Foundation.exit(EXIT_SUCCESS)
        }
        if let characteristic, characteristic.isNotifying {
            peripheral.setNotifyValue(false, for: characteristic)
        }
        central.cancelPeripheralConnection(peripheral)
    }

    private func fail(_ message: String) {
        emit(["type": "error", "message": message])
        queue.asyncAfter(deadline: .now() + .milliseconds(100)) {
            Foundation.exit(EXIT_FAILURE)
        }
    }

    private func emit(_ object: Any) {
        guard JSONSerialization.isValidJSONObject(object),
              let data = try? JSONSerialization.data(withJSONObject: object),
              var line = String(data: data, encoding: .utf8) else { return }
        line.append("\n")
        outputLock.lock()
        FileHandle.standardOutput.write(line.data(using: .utf8)!)
        outputLock.unlock()
    }
}

guard let line = readLine(),
      let data = line.data(using: .utf8),
      let configuration = try? JSONDecoder().decode(Configuration.self, from: data),
      !configuration.endpoints.isEmpty else {
    FileHandle.standardError.write(Data("Invalid configuration\n".utf8))
    Foundation.exit(EXIT_FAILURE)
}

let bridge = BleBridge(configuration: configuration)
DispatchQueue.global().async {
    while let command = readLine() {
        bridge.handleCommand(command)
    }
}
dispatchMain()
