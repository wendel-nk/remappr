# Installation

Remappr runs two ways:

- **In the browser** — open [remappr.com](https://remappr.com). Nothing to
  install; uses WebHID / Web Serial / Web Bluetooth (Chromium-based browsers).
- **As a desktop app (Electron)** — native HID, serial and BLE transports, no
  browser device-picker limitations. Recommended for daily use.

All desktop builds are published on the
[GitHub Releases page](https://github.com/Wolffyx/remappr/releases/latest).
Artifact names follow `remappr-electron-<version>.<ext>` (e.g.
`remappr-electron-0.0.12.AppImage`).

## Linux

Pick the package that matches your distribution. All of them install the same
app; the AppImage and tarball are distro-agnostic fallbacks.

| Distro          | Artifact    | Install command                          |
| --------------- | ----------- | ---------------------------------------- |
| Arch / Manjaro  | `.pacman`   | `sudo pacman -U <file>.pacman`           |
| Debian / Ubuntu | `.deb`      | `sudo apt install ./<file>.deb`          |
| Fedora / RHEL   | `.rpm`      | `sudo dnf install ./<file>.rpm`          |
| Any             | `.AppImage` | `chmod +x`, then run                     |
| Any             | `.tar.gz`   | extract, run the `remappr` binary inside |

### Arch Linux / Manjaro

```bash
curl -LO https://github.com/Wolffyx/remappr/releases/latest/download/remappr-electron-0.0.12.pacman
sudo pacman -U remappr-electron-0.0.12.pacman
```

(Replace the version with the latest release.) `pacman -U` resolves the
package's declared dependencies from the repos automatically.

### Debian / Ubuntu

```bash
curl -LO https://github.com/Wolffyx/remappr/releases/latest/download/remappr-electron-0.0.12.deb
sudo apt install ./remappr-electron-0.0.12.deb
```

Use `apt install ./file.deb` (not `dpkg -i`) so missing dependencies are pulled
in automatically.

### Fedora / RHEL / openSUSE

```bash
curl -LO https://github.com/Wolffyx/remappr/releases/latest/download/remappr-electron-0.0.12.rpm
sudo dnf install ./remappr-electron-0.0.12.rpm
```

On openSUSE use `sudo zypper install ./remappr-electron-<version>.rpm`.

### AppImage (any distro)

```bash
chmod +x remappr-electron-0.0.12.AppImage
./remappr-electron-0.0.12.AppImage
```

AppImages need FUSE 2 at runtime. If launch fails with a `libfuse.so.2` /
`fusermount` error:

- **Debian / Ubuntu ≥ 22.04:** `sudo apt install libfuse2` (24.04+: `libfuse2t64`)
- **Fedora:** `sudo dnf install fuse fuse-libs`
- **Arch:** `sudo pacman -S fuse2`

As a last resort, `./remappr-….AppImage --appimage-extract` unpacks it and
`squashfs-root/AppRun` runs without FUSE.

### Tarball (any distro)

```bash
tar -xzf remappr-electron-0.0.12.tar.gz
cd remappr-electron-0.0.12 && ./remappr
```

No desktop integration (menu entry, icon) — prefer a native package or the
AppImage unless you know you want this.

### Device permissions on Linux

The desktop app talks to keyboards over three transports; each needs OS-level
access:

#### Raw HID (QMK / VIA / Vial / Keychron)

`/dev/hidraw*` nodes are root-only by default. Add a udev rule so your desktop
session gets access:

```bash
sudo tee /etc/udev/rules.d/92-remappr.rules > /dev/null <<'EOF'
KERNEL=="hidraw*", SUBSYSTEM=="hidraw", MODE="0660", TAG+="uaccess"
EOF
sudo udevadm control --reload-rules && sudo udevadm trigger
```

Unplug and replug the keyboard afterwards. (`TAG+="uaccess"` grants access to
the active logged-in session via systemd-logind — the same rule VIA and Vial
document.)

#### USB serial (ZMK over CDC-ACM)

`/dev/ttyACM*` devices belong to a group — add yourself to it, then log out and
back in:

- **Debian / Ubuntu / Fedora:** `sudo usermod -aG dialout $USER`
- **Arch:** `sudo usermod -aG uucp $USER`

#### BLE (ZMK / Keychron wireless)

BLE uses **BlueZ over D-Bus** directly — make sure the Bluetooth service is
running:

```bash
sudo systemctl enable --now bluetooth
```

No extra permissions are normally needed; the default BlueZ/polkit policy
allows active desktop sessions to scan and pair.

## macOS

Download the `.dmg` (a single **universal** build — runs natively on both
Intel and Apple Silicon), open it and drag **Remappr** into **Applications**.

::: warning Gatekeeper — "Remappr is damaged" / "cannot be opened"
Remappr is an open-source project without an Apple Developer ID, so builds are
not notarized. The first launch is blocked by Gatekeeper. Either:

- **Right-click** (or <kbd>Ctrl</kbd>-click) the app in Applications →
  **Open** → **Open** (only needed once), or
- clear the quarantine flag from a terminal:

    ```bash
    xattr -dr com.apple.quarantine /Applications/Remappr.app
    ```

:::

On first BLE use macOS asks for **Bluetooth** permission — approve it (also
manageable later under **System Settings → Privacy & Security → Bluetooth**).
No extra setup is needed for HID or serial devices.

## Windows

Download `remappr-electron-<version>-setup.exe` and run it. Windows
SmartScreen may warn about an unrecognized app — choose **More info → Run
anyway** (builds are unsigned).

For ZMK over USB no driver setup is needed on Windows 10+; CDC-ACM is
built in.

## Updating

Grab the newer package from
[Releases](https://github.com/Wolffyx/remappr/releases/latest) and install it
over the old one (`pacman -U` / `apt install` / `dnf install` upgrade in
place; on macOS replace the app in Applications). Older releases keep their
notes but their binaries are pruned — always download from the latest release.
