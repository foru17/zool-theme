export const OS_ICON_KEYS = [
  'almalinux',
  'alpinelinux',
  'android',
  'apple',
  'archlinux',
  'centos',
  'debian',
  'fedora',
  'freebsd',
  'gentoo',
  'kalilinux',
  'linux',
  'linuxmint',
  'manjaro',
  'nixos',
  'openbsd',
  'openwrt',
  'opensuse',
  'proxmox',
  'raspberrypi',
  'redhat',
  'rockylinux',
  'synology',
  'truenas',
  'ubuntu',
  'unraid',
  'windows',
] as const

export type OsKey = (typeof OS_ICON_KEYS)[number]

// Product names precede their base distributions (for example, Proxmox on Debian).
const RULES: readonly (readonly [RegExp, OsKey])[] = [
  [/proxmox|\bpve\b/i, 'proxmox'],
  [/raspbian|raspberry ?pi/i, 'raspberrypi'],
  [/linux ?mint/i, 'linuxmint'],
  [/kali/i, 'kalilinux'],
  [/manjaro/i, 'manjaro'],
  [/openwrt|istoreos|immortalwrt|lede/i, 'openwrt'],
  [/synology|dsm/i, 'synology'],
  [/unraid/i, 'unraid'],
  [/truenas|freenas/i, 'truenas'],
  [/alma/i, 'almalinux'],
  [/rocky/i, 'rockylinux'],
  [/cent ?os/i, 'centos'],
  [/rhel|red ?hat/i, 'redhat'],
  [/fedora/i, 'fedora'],
  [/ubuntu/i, 'ubuntu'],
  [/debian|devuan|armbian/i, 'debian'],
  [/\barch(?:linux)?\b/i, 'archlinux'],
  [/alpine/i, 'alpinelinux'],
  [/opensuse|suse|sles/i, 'opensuse'],
  [/gentoo/i, 'gentoo'],
  [/nixos/i, 'nixos'],
  [/freebsd/i, 'freebsd'],
  [/openbsd/i, 'openbsd'],
  [/darwin|mac ?os|\bos ?x\b/i, 'apple'],
  [/windows/i, 'windows'],
  [/android/i, 'android'],
  // Preserve existing OsGlyph aliases where no dedicated rule above applies.
  [/elementary|pop!?_?os/i, 'ubuntu'],
  [/istore|qwrt/i, 'openwrt'],
  [/endeavour/i, 'archlinux'],
  [/oracle ?linux|euler|opencloudos|anolis/i, 'centos'],
  [/nobara/i, 'fedora'],
  [/microsoft|win(dows)? ?server/i, 'windows'],
]

/** Resolve Komari OS descriptions and Nezha platform IDs without UI dependencies. */
export function osKey(os: string): OsKey {
  const text = os ?? ''
  for (const [pattern, key] of RULES) if (pattern.test(text)) return key
  return 'linux'
}
