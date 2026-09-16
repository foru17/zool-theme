import { describe, expect, it } from 'vitest'
import { OS_KEYS } from '../src/core/os.manifest'
import { OS_ICON_KEYS, osKey, type OsKey } from '../src/core/os'

const cases: [string, OsKey][] = [
  // Komari product descriptions.
  ['Debian GNU/Linux 13 (trixie)', 'debian'],
  ['Debian GNU/Linux 12 (bookworm)', 'debian'],
  ['Debian GNU/Linux 11 (bullseye)', 'debian'],
  ['iStoreOS 24.10.1', 'openwrt'],
  ['OpenWrt 21.02-SNAPSHOT', 'openwrt'],
  ['Synology 216+II DSM 6.2.2', 'synology'],
  ['Ubuntu 22.04.4 LTS', 'ubuntu'],
  ['Ubuntu 24.04 LTS', 'ubuntu'],
  ['Windows Server 2022 Datacenter', 'windows'],
  ['Microsoft Windows 11 Pro', 'windows'],
  ['macOS 14.5', 'apple'],
  ['CentOS Linux 7 (Core)', 'centos'],
  ['Rocky Linux 9.3 (Blue Onyx)', 'rockylinux'],
  ['AlmaLinux 9.4', 'almalinux'],
  ['Red Hat Enterprise Linux 9.2', 'redhat'],
  ['Fedora Linux 40', 'fedora'],
  ['Arch Linux', 'archlinux'],
  ['Alpine Linux v3.20', 'alpinelinux'],
  ['openSUSE Leap 15.5', 'opensuse'],
  ['Gentoo Linux', 'gentoo'],
  ['NixOS 24.05', 'nixos'],
  ['Manjaro Linux', 'manjaro'],
  ['Linux Mint 21.3', 'linuxmint'],
  ['Kali GNU/Linux Rolling', 'kalilinux'],
  ['Raspbian GNU/Linux 11 (bullseye)', 'raspberrypi'],
  ['Proxmox VE 8.2', 'proxmox'],
  ['Unraid 6.12', 'unraid'],
  ['TrueNAS SCALE 24.04', 'truenas'],
  ['FreeBSD 14.0-RELEASE', 'freebsd'],
  ['OpenBSD 7.5', 'openbsd'],
  ['Android 14', 'android'],
  ['Armbian 24.5 bookworm', 'debian'],
  ['ImmortalWrt 23.05', 'openwrt'],

  // Nezha host.platform values.
  ['debian', 'debian'],
  ['ubuntu', 'ubuntu'],
  ['centos', 'centos'],
  ['almalinux', 'almalinux'],
  ['rocky', 'rockylinux'],
  ['opensuse-leap', 'opensuse'],
  ['alpine', 'alpinelinux'],
  ['arch', 'archlinux'],
  ['freebsd', 'freebsd'],
  ['darwin', 'apple'],
  ['windows', 'windows'],
  ['istoreos', 'openwrt'],
  ['openwrt', 'openwrt'],
  ['android', 'android'],

  // Remaining aliases, distribution precedence, and case insensitivity.
  ['Devuan GNU/Linux 5 (daedalus)', 'debian'],
  ['RHEL 9.2', 'redhat'],
  ['redhat', 'redhat'],
  ['linuxmint', 'linuxmint'],
  ['Raspberry Pi OS (Debian GNU/Linux 12)', 'raspberrypi'],
  ['raspberrypi', 'raspberrypi'],
  ['Proxmox VE 8.2 (Debian GNU/Linux 12)', 'proxmox'],
  ['pve', 'proxmox'],
  ['SUSE Linux Enterprise Server 15 SP5', 'opensuse'],
  ['SLES 15 SP5', 'opensuse'],
  ['LEDE 17.01.7', 'openwrt'],
  ['DSM 7.2', 'synology'],
  ['FreeNAS 11.3', 'truenas'],
  ['Mac OS X 10.15', 'apple'],
  ['OS X 10.11', 'apple'],
  ['DEBIAN GNU/LINUX 12', 'debian'],
  ['iStOrEoS 24.10.1', 'openwrt'],
  ['Linux Mint 21.3 (Ubuntu 22.04)', 'linuxmint'],
  ['Kali GNU/Linux (Debian)', 'kalilinux'],
  ['Manjaro Linux (Arch Linux)', 'manjaro'],
  ['TrueNAS SCALE (Debian GNU/Linux)', 'truenas'],

  // Non-conflicting aliases recognized by the existing OsGlyph mapper.
  ['ArchLinux', 'archlinux'],
  ['Cent OS 7', 'centos'],
  ['OSX', 'apple'],
  ['elementary OS 7.1', 'ubuntu'],
  ['Pop!_OS 22.04', 'ubuntu'],
  ['iStore', 'openwrt'],
  ['QWRT', 'openwrt'],
  ['EndeavourOS', 'archlinux'],
  ['Oracle Linux Server 9.2', 'centos'],
  ['openEuler 22.03 LTS', 'centos'],
  ['OpenCloudOS 9', 'centos'],
  ['Anolis OS 8.9', 'centos'],
  ['Nobara Linux 40', 'fedora'],
  ['Microsoft', 'windows'],
  ['Win Server 2022', 'windows'],
  ['Raspberry Pi', 'raspberrypi'],
  ['Anolis OS x86_64', 'centos'],
  ['OpenCloudOS x64', 'centos'],
  ['upvest-agent', 'linux'],

  // Empty, generic, unknown, and architecture strings must fall back to Linux.
  ['', 'linux'],
  ['Linux', 'linux'],
  ['Some Unknown OS 1.0', 'linux'],
  ['x86_64 architecture', 'linux'],
  ['aarch64', 'linux'],
  ['ARCHITECTURE', 'linux'],
  ['Slackware 15.0', 'linux'],
]

describe('osKey', () => {
  it.each(cases)('maps %j to %s', (input, expected) => {
    expect(osKey(input)).toBe(expected)
    expect(osKey(input.toUpperCase())).toBe(expected)
    expect(osKey(input.toLowerCase())).toBe(expected)
  })

  it('covers all 27 distinct icon keys with actual case outputs', () => {
    expect(OS_ICON_KEYS).toHaveLength(27)
    expect(new Set(OS_ICON_KEYS).size).toBe(27)
    expect(new Set(cases.map(([input]) => osKey(input)))).toEqual(new Set(OS_ICON_KEYS))
  })

  it('names exactly the keys the sprite ships', () => {
    expect(new Set(OS_ICON_KEYS)).toEqual(OS_KEYS)
  })
})
