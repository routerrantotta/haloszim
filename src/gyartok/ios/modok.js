/**
 * Az IOS-szerű parancssor módjai.
 *
 *   felhasznalo        Switch>                  (user EXEC)
 *   priv               Switch#                  (privileged EXEC, „enable” után)
 *   konfig             Switch(config)#          (global configuration)
 *   konfig-if          Switch(config-if)#       (egy interfész beállítása)
 *   konfig-if-tartomany Switch(config-if-range)# (több interfész egyszerre)
 *   konfig-vlan        Switch(config-vlan)#     (egy VLAN beállítása)
 *
 * Mezők:
 *   prompt(hostname)  – a prompt szövege
 *   exec              – exec mód-e (itt az ismeretlen szót gépnévnek veszi az eszköz)
 *   konfig            – konfigurációs mód-e (end, Ctrl+Z, do működik)
 *   visszaesik        – ha a parancs itt ismeretlen, ebben a módban is megpróbálja
 *   tortenet          – melyik előzménylistát használja (az IOS az exec és a konfig módokét külön tárolja)
 *   sugoFejlec        – a csak „?” beírásakor kiírt első sor
 */
export const MODOK = {
  felhasznalo: {
    prompt: (h) => `${h}>`,
    exec: true,
    tortenet: 'exec',
    sugoFejlec: 'Exec commands:',
  },
  priv: {
    prompt: (h) => `${h}#`,
    exec: true,
    tortenet: 'exec',
    sugoFejlec: 'Exec commands:',
  },
  konfig: {
    prompt: (h) => `${h}(config)#`,
    konfig: true,
    tortenet: 'konfig',
    sugoFejlec: 'Configure commands:',
  },
  'konfig-if': {
    prompt: (h) => `${h}(config-if)#`,
    konfig: true,
    visszaesik: 'konfig',
    tortenet: 'konfig',
    sugoFejlec: 'Interface configuration commands:',
  },
  'konfig-if-tartomany': {
    prompt: (h) => `${h}(config-if-range)#`,
    konfig: true,
    visszaesik: 'konfig',
    tortenet: 'konfig',
    sugoFejlec: 'Interface configuration commands:',
  },
  'konfig-vlan': {
    prompt: (h) => `${h}(config-vlan)#`,
    konfig: true,
    visszaesik: 'konfig',
    tortenet: 'konfig',
    sugoFejlec: 'VLAN configuration commands:',
  },
};

/** Az összes konfigurációs mód neve (ezekben él az end, exit, do). */
export const KONFIG_MODOK = Object.keys(MODOK).filter((m) => MODOK[m].konfig);

/** A konfigurációs almódok (ezekből az exit a konfig módba visz vissza). */
export const ALMODOK = KONFIG_MODOK.filter((m) => m !== 'konfig');
