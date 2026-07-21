using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.GenericAttributeProfile;
using Windows.Devices.Enumeration;
using Windows.Storage.Streams;

namespace Remappr.WindowsBleHelper;

internal sealed record Endpoint(
    [property: JsonPropertyName("adapterId")] string AdapterId,
    [property: JsonPropertyName("serviceUuid")] string ServiceUuid,
    [property: JsonPropertyName("charUuid")] string CharUuid
);

internal sealed record Configuration(
    [property: JsonPropertyName("mode")] string Mode,
    [property: JsonPropertyName("deviceId")] string? DeviceId,
    [property: JsonPropertyName("endpoints")] Endpoint[] Endpoints
);

internal sealed record Command(
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("data")] string? Data
);

internal sealed record ResolvedEndpoint(
    Endpoint Endpoint,
    GattDeviceService Service,
    GattCharacteristic Characteristic
);

internal sealed record HelperDevice(string Id, string Label);

internal sealed class BleBridge : IAsyncDisposable
{
    private const string DevicePrefix = "winrt:";
    private const int ConservativeGattPayload = 20;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private readonly Configuration configuration;
    private readonly object outputLock = new();
    private readonly TaskCompletionSource disconnected = new(
        TaskCreationOptions.RunContinuationsAsynchronously
    );
    private BluetoothLEDevice? device;
    private GattDeviceService? service;
    private GattCharacteristic? characteristic;
    private volatile bool closing;

    internal BleBridge(Configuration configuration)
    {
        this.configuration = configuration;
    }

    internal async Task<int> ListAsync()
    {
        string selector = BluetoothLEDevice.GetDeviceSelectorFromPairingState(true);
        string[] properties = ["System.Devices.Aep.IsConnected"];
        DeviceInformationCollection infos = await DeviceInformation.FindAllAsync(
            selector,
            properties,
            DeviceInformationKind.AssociationEndpoint
        );
        IEnumerable<DeviceInformation> ordered = infos.OrderByDescending(IsConnected);
        SemaphoreSlim probeSlots = new(4);
        List<Task<HelperDevice?>> pending = ordered
            .Select(info => ProbeDeviceAsync(info, probeSlots))
            .ToList();
        List<HelperDevice> devices = [];
        Task deadline = Task.Delay(TimeSpan.FromSeconds(12));

        while (pending.Count > 0)
        {
            Task<Task<HelperDevice?>> nextTask = Task.WhenAny(pending);
            Task completed = await Task.WhenAny(nextTask, deadline);
            if (completed == deadline)
            {
                Console.Error.WriteLine(
                    $"Bluetooth discovery timed out with {pending.Count} device probes unfinished"
                );
                break;
            }
            Task<HelperDevice?> probe = await nextTask;
            pending.Remove(probe);
            HelperDevice? found = await probe;
            if (found is not null)
            {
                devices.Add(found);
            }
        }

        Emit(new { type = "devices", devices });
        return 0;
    }

    internal int SelfTest()
    {
        string selector = BluetoothLEDevice.GetDeviceSelectorFromPairingState(true);
        bool ok = !string.IsNullOrWhiteSpace(selector);
        Emit(new { type = "self-test", ok });
        return ok ? 0 : 1;
    }

    private async Task<HelperDevice?> ProbeDeviceAsync(
        DeviceInformation info,
        SemaphoreSlim probeSlots
    )
    {
        await probeSlots.WaitAsync();
        BluetoothLEDevice? candidate = null;
        ResolvedEndpoint? resolved = null;
        try
        {
            candidate = await BluetoothLEDevice.FromIdAsync(info.Id);
            if (candidate is null)
            {
                Console.Error.WriteLine("Could not open a paired BLE device");
                return null;
            }

            resolved = await ResolveEndpointAsync(candidate);
            if (resolved is null)
            {
                return null;
            }

            return new HelperDevice(
                EncodeDeviceId(info.Id),
                string.IsNullOrWhiteSpace(info.Name)
                    ? candidate.Name ?? "BLE Device"
                    : info.Name
            );
        }
        catch (Exception error)
        {
            Console.Error.WriteLine($"BLE probe failed: {error.Message}");
            return null;
        }
        finally
        {
            resolved?.Service.Dispose();
            candidate?.Dispose();
            probeSlots.Release();
        }
    }

    private static bool IsConnected(DeviceInformation info)
    {
        return info.Properties.TryGetValue("System.Devices.Aep.IsConnected", out object? value)
            && value is true;
    }

    internal async Task<int> ConnectAndRunAsync()
    {
        if (string.IsNullOrWhiteSpace(configuration.DeviceId))
        {
            return Fail("Missing Windows Bluetooth device ID");
        }

        string? rawDeviceId = DecodeDeviceId(configuration.DeviceId);
        if (rawDeviceId is null)
        {
            return Fail("Invalid Windows Bluetooth device ID");
        }

        device = await BluetoothLEDevice.FromIdAsync(rawDeviceId);
        if (device is null)
        {
            return Fail("Windows could not open the connected Bluetooth keyboard");
        }

        device.ConnectionStatusChanged += OnConnectionStatusChanged;
        ResolvedEndpoint? resolved = await ResolveEndpointAsync(device);
        if (resolved is null)
        {
            return Fail("The keyboard exposes no supported firmware configuration service");
        }

        service = resolved.Service;
        characteristic = resolved.Characteristic;
        characteristic.ValueChanged += OnValueChanged;

        GattClientCharacteristicConfigurationDescriptorValue cccd =
            characteristic.CharacteristicProperties.HasFlag(
                GattCharacteristicProperties.Indicate
            )
                ? GattClientCharacteristicConfigurationDescriptorValue.Indicate
                : GattClientCharacteristicConfigurationDescriptorValue.Notify;
        GattCommunicationStatus notifyStatus =
            await characteristic.WriteClientCharacteristicConfigurationDescriptorAsync(cccd);
        if (notifyStatus != GattCommunicationStatus.Success)
        {
            return Fail($"Windows could not enable Studio notifications ({notifyStatus})");
        }

        Emit(
            new
            {
                type = "ready",
                label = string.IsNullOrWhiteSpace(device.Name) ? "BLE Device" : device.Name,
                firmwareAdapterId = resolved.Endpoint.AdapterId,
            }
        );

        while (true)
        {
            Task<string?> readTask = Console.In.ReadLineAsync();
            Task completed = await Task.WhenAny(readTask, disconnected.Task);
            if (completed == disconnected.Task)
            {
                return 1;
            }

            string? line = await readTask;
            if (line is null)
            {
                closing = true;
                return 0;
            }

            Command? command;
            try
            {
                command = JsonSerializer.Deserialize<Command>(line, JsonOptions);
            }
            catch (JsonException)
            {
                continue;
            }

            if (command?.Type == "close")
            {
                closing = true;
                return 0;
            }
            if (command?.Type != "write" || string.IsNullOrWhiteSpace(command.Data))
            {
                continue;
            }

            byte[] bytes;
            try
            {
                bytes = Convert.FromBase64String(command.Data);
            }
            catch (FormatException)
            {
                return Fail("Invalid base64 write payload");
            }

            if (!await WriteAsync(bytes))
            {
                return 1;
            }
        }
    }

    private async Task<ResolvedEndpoint?> ResolveEndpointAsync(BluetoothLEDevice candidate)
    {
        foreach (Endpoint endpoint in configuration.Endpoints)
        {
            if (!Guid.TryParse(endpoint.ServiceUuid, out Guid serviceUuid)
                || !Guid.TryParse(endpoint.CharUuid, out Guid characteristicUuid))
            {
                continue;
            }

            foreach (BluetoothCacheMode cacheMode in new[]
                     {
                         BluetoothCacheMode.Cached,
                         BluetoothCacheMode.Uncached,
                     })
            {
                GattDeviceServicesResult servicesResult =
                    await candidate.GetGattServicesForUuidAsync(serviceUuid, cacheMode);
                if (servicesResult.Status != GattCommunicationStatus.Success)
                {
                    if (cacheMode == BluetoothCacheMode.Uncached)
                    {
                        Console.Error.WriteLine(
                            $"Service {serviceUuid} on a paired device returned "
                                + $"{servicesResult.Status} protocol={servicesResult.ProtocolError}"
                        );
                    }
                    continue;
                }

                foreach (GattDeviceService candidateService in servicesResult.Services)
                {
                    GattCharacteristicsResult charsResult =
                        await candidateService.GetCharacteristicsForUuidAsync(
                            characteristicUuid,
                            cacheMode
                        );
                    if (charsResult.Status != GattCommunicationStatus.Success)
                    {
                        if (cacheMode == BluetoothCacheMode.Uncached)
                        {
                            Console.Error.WriteLine(
                                $"Characteristic {characteristicUuid} on a paired device returned "
                                    + $"{charsResult.Status} protocol={charsResult.ProtocolError}"
                            );
                        }
                        candidateService.Dispose();
                        continue;
                    }

                    GattCharacteristic? candidateCharacteristic =
                        charsResult.Characteristics.FirstOrDefault(IsUsableCharacteristic);
                    if (candidateCharacteristic is not null)
                    {
                        foreach (GattDeviceService other in servicesResult.Services)
                        {
                            if (!ReferenceEquals(other, candidateService))
                            {
                                other.Dispose();
                            }
                        }
                        return new ResolvedEndpoint(
                            endpoint,
                            candidateService,
                            candidateCharacteristic
                        );
                    }
                    candidateService.Dispose();
                }
                if (servicesResult.Services.Count > 0)
                {
                    // A cached service existed but did not expose a usable
                    // characteristic; refresh it once before trying the next endpoint.
                    continue;
                }
                if (cacheMode == BluetoothCacheMode.Uncached)
                {
                    Console.Error.WriteLine(
                        $"Service {serviceUuid} was absent on a paired device"
                    );
                }
            }
        }
        return null;
    }

    private static bool IsUsableCharacteristic(GattCharacteristic candidate)
    {
        GattCharacteristicProperties properties = candidate.CharacteristicProperties;
        bool canReceive = properties.HasFlag(GattCharacteristicProperties.Notify)
            || properties.HasFlag(GattCharacteristicProperties.Indicate);
        bool canWrite = properties.HasFlag(GattCharacteristicProperties.Write)
            || properties.HasFlag(GattCharacteristicProperties.WriteWithoutResponse);
        return canReceive && canWrite;
    }

    private async Task<bool> WriteAsync(byte[] bytes)
    {
        if (characteristic is null)
        {
            Fail("No active Windows GATT characteristic");
            return false;
        }

        GattWriteOption option = characteristic.CharacteristicProperties.HasFlag(
            GattCharacteristicProperties.WriteWithoutResponse
        )
            ? GattWriteOption.WriteWithoutResponse
            : GattWriteOption.WriteWithResponse;

        for (int offset = 0; offset < bytes.Length; offset += ConservativeGattPayload)
        {
            int length = Math.Min(ConservativeGattPayload, bytes.Length - offset);
            using DataWriter writer = new();
            writer.WriteBytes(bytes.AsSpan(offset, length).ToArray());
            GattCommunicationStatus status = await characteristic.WriteValueAsync(
                writer.DetachBuffer(),
                option
            );
            if (status != GattCommunicationStatus.Success)
            {
                Fail($"Windows GATT write failed ({status})");
                return false;
            }
        }
        return true;
    }

    private void OnValueChanged(
        GattCharacteristic sender,
        GattValueChangedEventArgs args
    )
    {
        using DataReader reader = DataReader.FromBuffer(args.CharacteristicValue);
        byte[] bytes = new byte[reader.UnconsumedBufferLength];
        reader.ReadBytes(bytes);
        Emit(new { type = "data", data = Convert.ToBase64String(bytes) });
    }

    private void OnConnectionStatusChanged(BluetoothLEDevice sender, object args)
    {
        if (sender.ConnectionStatus != BluetoothConnectionStatus.Disconnected || closing)
        {
            return;
        }
        Emit(new { type = "disconnected", error = "Windows reported the BLE device disconnected" });
        disconnected.TrySetResult();
    }

    private int Fail(string message)
    {
        Emit(new { type = "error", message });
        return 1;
    }

    private void Emit(object payload)
    {
        string line = JsonSerializer.Serialize(payload, JsonOptions);
        lock (outputLock)
        {
            Console.Out.WriteLine(line);
            Console.Out.Flush();
        }
    }

    private static string EncodeDeviceId(string id)
    {
        return DevicePrefix
            + Convert.ToBase64String(Encoding.UTF8.GetBytes(id))
                .TrimEnd('=')
                .Replace('+', '-')
                .Replace('/', '_');
    }

    private static string? DecodeDeviceId(string encoded)
    {
        if (!encoded.StartsWith(DevicePrefix, StringComparison.Ordinal))
        {
            return null;
        }
        string value = encoded[DevicePrefix.Length..].Replace('-', '+').Replace('_', '/');
        value += new string('=', (4 - value.Length % 4) % 4);
        try
        {
            return Encoding.UTF8.GetString(Convert.FromBase64String(value));
        }
        catch (FormatException)
        {
            return null;
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (characteristic is not null)
        {
            characteristic.ValueChanged -= OnValueChanged;
            if (closing && device?.ConnectionStatus == BluetoothConnectionStatus.Connected)
            {
                try
                {
                    Task<GattCommunicationStatus> clearTask =
                        characteristic
                            .WriteClientCharacteristicConfigurationDescriptorAsync(
                                GattClientCharacteristicConfigurationDescriptorValue.None
                            )
                            .AsTask();
                    await clearTask.WaitAsync(TimeSpan.FromMilliseconds(750));
                }
                catch
                {
                    // The OS may already have torn down the device.
                }
            }
        }
        if (device is not null)
        {
            device.ConnectionStatusChanged -= OnConnectionStatusChanged;
        }
        service?.Dispose();
        device?.Dispose();
    }
}

internal static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private static async Task<int> Main()
    {
        string? line = await Console.In.ReadLineAsync();
        if (line is null)
        {
            return 1;
        }

        Configuration? configuration;
        try
        {
            configuration = JsonSerializer.Deserialize<Configuration>(line, JsonOptions);
        }
        catch (JsonException)
        {
            configuration = null;
        }

        if (configuration is null || configuration.Endpoints is not { Length: > 0 })
        {
            Console.Error.WriteLine("Invalid helper configuration");
            return 1;
        }

        await using BleBridge bridge = new(configuration);
        return configuration.Mode switch
        {
            "self-test" => bridge.SelfTest(),
            "list" => await bridge.ListAsync(),
            "connect" => await bridge.ConnectAndRunAsync(),
            _ => 1,
        };
    }
}
