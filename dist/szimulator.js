/* Haloszim v0.9.0 – routerrantotta.hu – minden jog fenntartva. */
(() => {
  // src/mag/ido.js
  var Ora = class {
    constructor() {
      this.ido = 0;
      this.sor = [];
      this.kovetkezoSorszam = 0;
    }
    /**
     * Beütemez egy teendőt, ami `kesleltetes` ms múlva fut le.
     * @param {number} kesleltetes
     * @param {() => void} teendo
     * @returns {Esemeny} – ezzel később visszavonható (lemond)
     */
    utemez(kesleltetes, teendo) {
      const esemeny = { mikor: this.ido + Math.max(0, kesleltetes), sorszam: this.kovetkezoSorszam++, teendo };
      this.sor.push(esemeny);
      this.sor.sort((a, b) => a.mikor - b.mikor || a.sorszam - b.sorszam);
      return esemeny;
    }
    /** Visszavon egy korábban beütemezett eseményt. */
    lemond(esemeny) {
      this.sor = this.sor.filter((e) => e !== esemeny);
    }
    /**
     * Előre lépteti az órát `ms` ezredmásodperccel, és közben sorban lefuttatja
     * az esedékes eseményeket (ha egy esemény újat ütemez, az is lefut, ha belefér).
     * @param {number} ms
     */
    lep(ms) {
      const cel = this.ido + Math.max(0, ms);
      while (this.sor.length > 0 && this.sor[0].mikor <= cel) {
        const esemeny = this.sor.shift();
        this.ido = esemeny.mikor;
        esemeny.teendo();
      }
      this.ido = cel;
    }
  };
  var HONAPOK = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function naploIdobelyeg(ms) {
    const osszMp = Math.floor(ms / 1e3);
    const nap = 1 + Math.floor(osszMp / 86400);
    const ora = Math.floor(osszMp % 86400 / 3600);
    const perc = Math.floor(osszMp % 3600 / 60);
    const mp = osszMp % 60;
    const ezred = Math.floor(ms % 1e3);
    const k = (n, h = 2) => String(n).padStart(h, "0");
    return `*${HONAPOK[2]} ${String(nap).padStart(2, " ")} ${k(ora)}:${k(perc)}:${k(mp)}.${k(ezred, 3)}`;
  }

  // src/cli/interfesznev.js
  function tipusIllesztes(elotag, tipusok) {
    const kis = elotag.toLowerCase();
    const nevek = Object.keys(tipusok);
    const pontos = nevek.find((n) => n.toLowerCase() === kis);
    if (pontos) return { tipus: pontos, jeloltek: [pontos] };
    const jeloltek = nevek.filter((n) => n.toLowerCase().startsWith(kis));
    if (jeloltek.length === 1) return { tipus: jeloltek[0], jeloltek };
    if (jeloltek.length === 0) return { hiba: "nincs", jeloltek };
    return { hiba: "ketertelmu", jeloltek };
  }
  function szamEllenorzes(szam, letezok) {
    const normal = szam.split("/").map((r) => String(Number(r))).join("/");
    if (letezok.includes(normal)) return { ok: true };
    const reszek = szam.split("/");
    const letezoReszek = letezok.map((s) => s.split("/"));
    let eltolas = 0;
    for (let i = 0; i < reszek.length; i++) {
      const elotag = reszek.slice(0, i + 1);
      const vanIlyen = letezoReszek.some((lr) => elotag.every((r, j) => lr[j] === String(Number(r)) && /^\d+$/.test(r)));
      if (!vanIlyen) return { ok: false, eltolas };
      eltolas += reszek[i].length + 1;
    }
    return { ok: false, eltolas: szam.length };
  }
  function interfeszElemez(tokenek, i, tipusok) {
    const t = tokenek[i];
    const m = /^([a-zA-Z-]+)(.*)$/.exec(t.szoveg);
    if (!m) return { ok: false, hiba: "ervenytelen", oszlop: t.kezdet };
    const illesztes = tipusIllesztes(m[1], tipusok);
    if (illesztes.hiba === "ketertelmu") return { ok: false, hiba: "ketertelmu" };
    if (illesztes.hiba) return { ok: false, hiba: "ervenytelen", oszlop: t.kezdet };
    const tipus = illesztes.tipus;
    let szam = m[2];
    let szamKezdet = t.kezdet + m[1].length;
    let kovetkezo = i + 1;
    if (szam === "") {
      const kov = tokenek[i + 1];
      if (!kov) return { ok: false, hiba: "hianyos" };
      szam = kov.szoveg;
      szamKezdet = kov.kezdet;
      kovetkezo = i + 2;
    }
    if (!/^\d+(\/\d+)*$/.test(szam)) {
      const rossz = szam.search(/[^\d/]/);
      return { ok: false, hiba: "ervenytelen", oszlop: szamKezdet + Math.max(0, rossz) };
    }
    const ell = szamEllenorzes(szam, tipusok[tipus]);
    if (!ell.ok) {
      if (ell.eltolas >= szam.length) return { ok: false, hiba: "hianyos" };
      return { ok: false, hiba: "ervenytelen", oszlop: szamKezdet + ell.eltolas };
    }
    const normalSzam = szam.split("/").map((r) => String(Number(r))).join("/");
    return { ok: true, nev: tipus + normalSzam, tipus, szam: normalSzam, kovetkezo };
  }
  function tartomanyElemez(szoveg, kezdet, tipusok) {
    const nevek = [];
    let pozicio = 0;
    const darabok = szoveg.split(",");
    for (let d = 0; d < darabok.length; d++) {
      const darab = darabok[d];
      const darabKezdet = kezdet + pozicio;
      pozicio += darab.length + 1;
      const vezeto = darab.length - darab.trimStart().length;
      const tiszta = darab.trim();
      if (tiszta === "") {
        return { ok: false, hiba: d === darabok.length - 1 ? "hianyos" : "ervenytelen", oszlop: darabKezdet + vezeto };
      }
      const m = /^([a-zA-Z-]+)(\s*)(\d+(?:\/\d+)*)?(?:(\s*-\s*)(\d+)?)?(.*)$/.exec(tiszta);
      const elemKezdet = darabKezdet + vezeto;
      const illesztes = tipusIllesztes(m ? m[1] : tiszta, tipusok);
      if (!m || illesztes.hiba === "nincs") return { ok: false, hiba: "ervenytelen", oszlop: elemKezdet };
      if (illesztes.hiba === "ketertelmu") return { ok: false, hiba: "ketertelmu" };
      const tipus = illesztes.tipus;
      const [, tipusSzoveg, koz1, szam, kotojel, veg, maradek] = m;
      const szamKezdet = elemKezdet + tipusSzoveg.length + koz1.length;
      if (!szam) {
        if (maradek) return { ok: false, hiba: "ervenytelen", oszlop: szamKezdet };
        return { ok: false, hiba: "hianyos" };
      }
      const ell = szamEllenorzes(szam, tipusok[tipus]);
      if (!ell.ok) {
        if (ell.eltolas >= szam.length && !kotojel && !maradek) return { ok: false, hiba: "hianyos" };
        return { ok: false, hiba: "ervenytelen", oszlop: szamKezdet + Math.min(ell.eltolas, szam.length) };
      }
      const vegKezdet = szamKezdet + szam.length + (kotojel ? kotojel.length : 0);
      if (maradek) return { ok: false, hiba: "ervenytelen", oszlop: vegKezdet + (veg ? veg.length : 0) };
      if (kotojel && !veg) return { ok: false, hiba: "hianyos" };
      const reszek = szam.split("/").map(Number);
      const elsoPort = reszek[reszek.length - 1];
      const utolsoPort = veg !== void 0 ? Number(veg) : elsoPort;
      const elotag = reszek.slice(0, -1).join("/");
      if (utolsoPort < elsoPort) return { ok: false, hiba: "ervenytelen", oszlop: vegKezdet };
      for (let p = elsoPort; p <= utolsoPort; p++) {
        const sz = (elotag ? elotag + "/" : "") + p;
        if (!tipusok[tipus].includes(sz)) return { ok: false, hiba: "ervenytelen", oszlop: vegKezdet };
        const nev = tipus + sz;
        if (!nevek.includes(nev)) nevek.push(nev);
      }
    }
    return { ok: true, nevek };
  }

  // src/mag/ip.js
  function ipSzam(szoveg) {
    if (typeof szoveg !== "string") return null;
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(szoveg.trim());
    if (!m) return null;
    const reszek = m.slice(1).map(Number);
    if (reszek.some((r) => r > 255)) return null;
    return (reszek[0] << 24 >>> 0) + (reszek[1] << 16) + (reszek[2] << 8) + reszek[3];
  }
  function ipSzoveg(szam) {
    return [24, 16, 8, 0].map((t) => szam >>> t & 255).join(".");
  }
  function ervenyesIp(szoveg) {
    return ipSzam(szoveg) !== null;
  }
  function ervenyesMaszk(szoveg) {
    const m = ipSzam(szoveg);
    if (m === null || m === 0) return false;
    const inv = ~m >>> 0;
    return (inv + 1 & inv) === 0;
  }
  function prefixHossz(maszk) {
    let m = ipSzam(maszk);
    let n = 0;
    while (m & 2147483648) {
      n++;
      m = m << 1 >>> 0;
    }
    return n;
  }
  function egyHalozat(a, b, maszk) {
    const x = ipSzam(a);
    const y = ipSzam(b);
    const m = ipSzam(maszk);
    if (x === null || y === null || m === null) return false;
    return (x & m) >>> 0 === (y & m) >>> 0;
  }
  function gepcimHiba(ip, maszk) {
    const x = ipSzam(ip);
    const m = ipSzam(maszk);
    if (x === null) return "Érvénytelen IP-cím.";
    if (m === null || !ervenyesMaszk(maszk)) return "Érvénytelen alhálózati maszk.";
    const elso = x >>> 24;
    if (elso === 0 || elso === 127 || elso >= 224) return "Ez a cím nem adható egy gépnek.";
    const gep = (x & ~m) >>> 0;
    const gepResz = ~m >>> 0;
    if (gepResz > 1 && gep === 0) return "Ez a hálózat címe, gépnek nem adható.";
    if (gepResz > 1 && gep === gepResz) return "Ez a hálózat szórási címe, gépnek nem adható.";
    return null;
  }
  function maszkSzam(hossz) {
    return hossz === 0 ? 0 : 4294967295 << 32 - hossz >>> 0;
  }
  function maszkSzoveg(hossz) {
    return ipSzoveg(maszkSzam(hossz));
  }
  function halozatSzam(ip, hossz) {
    return (ip & maszkSzam(hossz)) >>> 0;
  }
  function osztalyos(ip) {
    const elso = ip >>> 24;
    const hossz = elso < 128 ? 8 : elso < 192 ? 16 : 24;
    return { halozat: halozatSzam(ip, hossz), hossz };
  }

  // src/mag/ipv6.js
  function ipv6Elemez(szoveg) {
    if (typeof szoveg !== "string") return null;
    const s = szoveg.trim();
    if (!/^[0-9a-fA-F:]+$/.test(s) || s.length < 2) return null;
    const dupla = s.split("::");
    if (dupla.length > 2) return null;
    const darabol = (r) => r === "" ? [] : r.split(":");
    const eleje = darabol(dupla[0]);
    const vege = dupla.length === 2 ? darabol(dupla[1]) : [];
    const jo = (x) => /^[0-9a-fA-F]{1,4}$/.test(x);
    if (!eleje.every(jo) || !vege.every(jo)) return null;
    let reszek;
    if (dupla.length === 2) {
      const hiany = 8 - eleje.length - vege.length;
      if (hiany < 1) return null;
      reszek = [...eleje, ...new Array(hiany).fill("0"), ...vege];
    } else {
      reszek = eleje;
    }
    if (reszek.length !== 8) return null;
    return reszek.map((r) => parseInt(r, 16));
  }
  function ipv6Szoveg(c) {
    let legKezd = -1;
    let legHossz = 0;
    for (let i = 0; i < 8; ) {
      if (c[i] !== 0) {
        i++;
        continue;
      }
      let j = i;
      while (j < 8 && c[j] === 0) j++;
      if (j - i > legHossz && j - i >= 2) {
        legKezd = i;
        legHossz = j - i;
      }
      i = j;
    }
    const hex = (x) => x.toString(16).toUpperCase();
    if (legKezd < 0) return c.map(hex).join(":");
    const eleje = c.slice(0, legKezd).map(hex).join(":");
    const vege = c.slice(legKezd + legHossz).map(hex).join(":");
    return `${eleje}::${vege}`;
  }
  function ipv6Normal(szoveg) {
    const c = ipv6Elemez(szoveg);
    return c ? ipv6Szoveg(c) : null;
  }
  function ipv6PrefixElemez(szoveg) {
    const m = /^([^/\s]+)\/(\d{1,3})$/.exec(String(szoveg).trim());
    if (!m) return null;
    const cim = ipv6Elemez(m[1]);
    const hossz = Number(m[2]);
    if (!cim || hossz > 128) return null;
    return { cim, hossz };
  }
  function ipv6Halozat(c, hossz) {
    return c.map((x, i) => {
      const bitek = Math.max(0, Math.min(16, hossz - i * 16));
      const maszk = bitek === 0 ? 0 : 65535 << 16 - bitek & 65535;
      return x & maszk;
    });
  }
  function ipv6EgyHalozat(a, b, hossz) {
    const x = ipv6Halozat(a, hossz);
    const y = ipv6Halozat(b, hossz);
    return x.every((v, i) => v === y[i]);
  }
  function linkLocalE(c) {
    return (c[0] & 65472) === 65152;
  }
  function csoportcimE(c) {
    return (c[0] & 65280) === 65280;
  }
  function eui64LinkLocal(mac) {
    const b = mac.match(/../g).map((x) => parseInt(x, 16));
    b[0] ^= 2;
    return [65152, 0, 0, 0, b[0] << 8 | b[1], b[2] << 8 | 255, 254 << 8 | b[3], b[4] << 8 | b[5]];
  }
  function ipv6CsoportMac(c) {
    const h4 = (x) => x.toString(16).padStart(4, "0");
    return "3333" + h4(c[6]) + h4(c[7]);
  }
  function solicitedNode(c) {
    return [65282, 0, 0, 0, 0, 1, 65280 | c[6] & 255, c[7]];
  }
  var RIPNG_CSOPORT = [65282, 0, 0, 0, 0, 0, 0, 9];

  // src/cli/ertelmezo.js
  function szavakra(sor2) {
    const tokenek = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(sor2)) !== null) tokenek.push({ szoveg: m[0], kezdet: m.index });
    return tokenek;
  }
  var PARAM_TIPUSOK = {
    /** Egész szám egy tartományban, pl. <1-4094> */
    szam: {
      nev: (e) => e.nev || `<${e.min}-${e.max}>`,
      illeszt(e, tokenek, i) {
        const t = tokenek[i];
        if (!/^\d+$/.test(t.szoveg)) return { ok: false, hiba: "ervenytelen", oszlop: t.kezdet };
        const n = Number(t.szoveg);
        if (n < e.min || n > e.max) return { ok: false, hiba: "ervenytelen", oszlop: t.kezdet };
        return { ok: true, ertek: n, kovetkezo: i + 1 };
      },
      sugoElemek: (e) => [{ nev: PARAM_TIPUSOK.szam.nev(e), sugo: e.sugo }],
      reszleges: (e, r) => /^\d+$/.test(r) ? [PARAM_TIPUSOK.szam.nev(e)] : [],
      kiegeszit: () => null
    },
    /** Egyetlen szó (szóköz nélkül), pl. gépnév, VLAN-név */
    szo: {
      nev: (e) => e.nev || "WORD",
      illeszt(e, tokenek, i) {
        const t = tokenek[i];
        if (e.maxHossz && t.szoveg.length > e.maxHossz) {
          return { ok: false, hiba: "ervenytelen", oszlop: t.kezdet + e.maxHossz };
        }
        return { ok: true, ertek: t.szoveg, kovetkezo: i + 1 };
      },
      sugoElemek: (e) => [{ nev: PARAM_TIPUSOK.szo.nev(e), sugo: e.sugo }],
      reszleges: (e) => [PARAM_TIPUSOK.szo.nev(e)],
      kiegeszit: () => null
    },
    /** IPv4-cím vagy -maszk pontozott alakban, pl. 10.1.12.0 (az érték egységes szöveg) */
    ipv4: {
      nev: (e) => e.nev || "A.B.C.D",
      illeszt(e, tokenek, i) {
        const t = tokenek[i];
        const n = ipSzam(t.szoveg);
        if (n === null) return { ok: false, hiba: "ervenytelen", oszlop: t.kezdet + ipv4HibaHely(t.szoveg) };
        return { ok: true, ertek: ipSzoveg(n), kovetkezo: i + 1 };
      },
      sugoElemek: (e) => [{ nev: PARAM_TIPUSOK.ipv4.nev(e), sugo: e.sugo }],
      reszleges: (e, r) => /^[\d.]+$/.test(r) ? [PARAM_TIPUSOK.ipv4.nev(e)] : [],
      kiegeszit: () => null
    },
    /** IPv6-cím előtaghossz nélkül, pl. FE80::1 (az érték egységes, nagybetűs rövid alak) */
    ipv6: {
      nev: (e) => e.nev || "X:X:X:X::X",
      illeszt(e, tokenek, i) {
        const t = tokenek[i];
        const c = t.szoveg.includes("/") ? null : ipv6Elemez(t.szoveg);
        if (!c) return { ok: false, hiba: "ervenytelen", oszlop: t.kezdet };
        return { ok: true, ertek: ipv6Szoveg(c), kovetkezo: i + 1 };
      },
      sugoElemek: (e) => [{ nev: PARAM_TIPUSOK.ipv6.nev(e), sugo: e.sugo }],
      reszleges: (e, r) => /^[0-9a-fA-F:]+$/.test(r) ? [PARAM_TIPUSOK.ipv6.nev(e)] : [],
      kiegeszit: () => null
    },
    /** IPv6-cím előtaghosszal, pl. 2001:DB8:ACAD:1::1/64 → { cim, hossz } */
    "ipv6-prefix": {
      nev: (e) => e.nev || "X:X:X:X::X/<0-128>",
      illeszt(e, tokenek, i) {
        const t = tokenek[i];
        const m = /^([^/]+)\/(\d{1,3})$/.exec(t.szoveg);
        const c = m && ipv6Elemez(m[1]);
        if (!c) return { ok: false, hiba: "ervenytelen", oszlop: t.kezdet };
        const hossz = Number(m[2]);
        if (hossz > 128) return { ok: false, hiba: "ervenytelen", oszlop: t.kezdet + m[1].length + 1 };
        return { ok: true, ertek: { cim: ipv6Szoveg(c), hossz }, kovetkezo: i + 1 };
      },
      sugoElemek: (e) => [{ nev: PARAM_TIPUSOK["ipv6-prefix"].nev(e), sugo: e.sugo }],
      reszleges: (e, r) => /^[0-9a-fA-F:/]+$/.test(r) ? [PARAM_TIPUSOK["ipv6-prefix"].nev(e)] : [],
      kiegeszit: () => null
    },
    /** OSPF-terület: szám (0–4294967295) vagy IPv4-alakú azonosító (0.0.0.0) → szám */
    terulet: {
      nev: () => "<0-4294967295>",
      illeszt(e, tokenek, i) {
        const t = tokenek[i];
        if (/^\d+$/.test(t.szoveg)) {
          const n2 = Number(t.szoveg);
          if (n2 > 4294967295) return { ok: false, hiba: "ervenytelen", oszlop: t.kezdet };
          return { ok: true, ertek: n2, kovetkezo: i + 1 };
        }
        const n = ipSzam(t.szoveg);
        if (n === null) return { ok: false, hiba: "ervenytelen", oszlop: t.kezdet + (/^[\d.]+$/.test(t.szoveg) ? ipv4HibaHely(t.szoveg) : 0) };
        return { ok: true, ertek: n >>> 0, kovetkezo: i + 1 };
      },
      sugoElemek: (e) => [{ nev: "<0-4294967295>", sugo: e.sugo }, { nev: "A.B.C.D", sugo: `${e.sugo} (IP-cím alakban)` }],
      reszleges: (e, r) => /^[\d.]+$/.test(r) ? ["<0-4294967295>", "A.B.C.D"] : [],
      kiegeszit: () => null
    },
    /** A sor teljes maradéka szövegként (pl. description) */
    sor: {
      maradekot: true,
      nev: (e) => e.nev || "LINE",
      illeszt(e, tokenek, i, sor2) {
        return { ok: true, ertek: sor2.slice(tokenek[i].kezdet).trimEnd(), kovetkezo: tokenek.length };
      },
      sugoElemek: (e) => [{ nev: e.nev || "LINE", sugo: e.sugo }],
      reszleges: (e) => [e.nev || "LINE"],
      kiegeszit: () => null
    },
    /** Egy interfész, pl. fa0/1 vagy „FastEthernet 0/1” (egy vagy két szó) */
    interfesz: {
      illeszt(e, tokenek, i, sor2, kornyezet) {
        const r = interfeszElemez(tokenek, i, kornyezet.portTipusok || {});
        if (!r.ok) return r;
        return { ok: true, ertek: r.nev, kovetkezo: r.kovetkezo };
      },
      sugoElemek: (e, kornyezet) => tipusSugo(e, kornyezet),
      reszleges: (e, r, kornyezet) => interfeszReszleges(r, kornyezet),
      kiegeszit: (e, r, kornyezet) => interfeszKiegeszit(r, kornyezet)
    },
    /** Interfész-tartomány: az interface range utáni teljes szöveg */
    "interfesz-tartomany": {
      maradekot: true,
      illeszt(e, tokenek, i, sor2, kornyezet) {
        const kezdet = tokenek[i].kezdet;
        const r = tartomanyElemez(sor2.slice(kezdet), kezdet, kornyezet.portTipusok || {});
        if (!r.ok) return r;
        return { ok: true, ertek: r.nevek, kovetkezo: tokenek.length };
      },
      sugoElemek: (e, kornyezet) => tipusSugo(e, kornyezet),
      reszleges: (e, r, kornyezet) => interfeszReszleges(r, kornyezet),
      kiegeszit: (e, r, kornyezet) => interfeszKiegeszit(r, kornyezet)
    }
  };
  function ipv4HibaHely(szoveg) {
    const reszek = szoveg.split(".");
    let hely = 0;
    for (let i = 0; i < reszek.length; i++) {
      const r = reszek[i];
      if (i > 3 || !/^\d{1,3}$/.test(r) || Number(r) > 255) {
        const m = /^\d*/.exec(r)[0];
        return hely + (Number(m) > 255 || m.length > 3 ? 0 : m.length);
      }
      hely += r.length + 1;
    }
    return szoveg.length;
  }
  function tipusSugo(e, kornyezet) {
    const tipusok = Object.keys(kornyezet.portTipusok || {});
    const leirasok = kornyezet.tipusLeirasok || {};
    return tipusok.map((t) => ({ nev: t, sugo: leirasok[t] || t }));
  }
  function interfeszReszleges(r, kornyezet) {
    const tipusok = kornyezet.portTipusok || {};
    const m = /^([a-zA-Z-]+)(.*)$/.exec(r);
    if (!m) return [];
    if (m[2] === "") return tipusIllesztes(m[1], tipusok).jeloltek;
    const ill = tipusIllesztes(m[1], tipusok);
    if (!ill.tipus) return [];
    return szamReszleges(m[2], tipusok[ill.tipus]);
  }
  function szamReszleges(szam, letezok) {
    const reszek = szam.split("/");
    const melyikResz = reszek.length - 1;
    const elotag = reszek.slice(0, -1).join("/");
    const illok = letezok.filter((s) => s.startsWith(elotag ? elotag + "/" : ""));
    if (illok.length === 0) return [];
    const ertekek2 = [...new Set(illok.map((s) => Number(s.split("/")[melyikResz])))].sort((a, b) => a - b);
    const utolso = reszek[melyikResz];
    if (utolso !== "" && !ertekek2.some((v) => String(v).startsWith(utolso))) return [];
    const teljes = utolso !== "" && ertekek2.includes(Number(utolso));
    const vanMeg = illok.some((s) => s.split("/").length > melyikResz + 1);
    if (teljes && vanMeg) return ["/"];
    return [`<${ertekek2[0]}-${ertekek2[ertekek2.length - 1]}>`];
  }
  function interfeszKiegeszit(r, kornyezet) {
    if (!/^[a-zA-Z-]+$/.test(r)) return null;
    const ill = tipusIllesztes(r, kornyezet.portTipusok || {});
    return ill.tipus || null;
  }
  function ujCsomopont() {
    return { kulcsszavak: [], parameterek: [], parancs: null, tovabb: null };
  }
  function azonosParam(a, b) {
    return a.param === b.param && a.kulcs === b.kulcs && a.min === b.min && a.max === b.max;
  }
  function faEpites(parancsok) {
    const fak = {};
    for (const parancs of parancsok) {
      for (const mod of parancs.modok) {
        let cs = fak[mod] = fak[mod] || ujCsomopont();
        for (const elem6 of parancs.szavak) {
          if (elem6.tovabb) {
            cs.tovabb = elem6.tovabb;
            break;
          }
          if (elem6.szo) {
            let gy = cs.kulcsszavak.find((k) => k.elem.szo.toLowerCase() === elem6.szo.toLowerCase());
            if (!gy) cs.kulcsszavak.push(gy = { elem: elem6, csomopont: ujCsomopont() });
            cs = gy.csomopont;
          } else if (elem6.param) {
            if (!PARAM_TIPUSOK[elem6.param]) throw new Error(`Ismeretlen paramétertípus: ${elem6.param}`);
            let gy = cs.parameterek.find((p) => azonosParam(p.elem, elem6));
            if (!gy) cs.parameterek.push(gy = { elem: elem6, csomopont: ujCsomopont() });
            cs = gy.csomopont;
          } else {
            throw new Error("Hibás parancsleírás: " + JSON.stringify(elem6));
          }
        }
        if (!parancs.szavak.some((e) => e.tovabb)) {
          if (cs.parancs) {
            throw new Error(`Kétszer van leírva ugyanaz a parancs (${mod}): ${parancs.szavak.map((e) => e.szo || e.param).join(" ")}`);
          }
          cs.parancs = parancs;
        }
      }
    }
    return fak;
  }
  function kulcsszoJeloltek(cs, szoveg) {
    const kis = szoveg.toLowerCase();
    const pontos = cs.kulcsszavak.find((k) => k.elem.szo.toLowerCase() === kis);
    if (pontos) return [pontos];
    return cs.kulcsszavak.filter((k) => k.elem.szo.toLowerCase().startsWith(kis));
  }
  function bejar(fak, mod, tokenek, sor2, kornyezet, { megallMaradeknal = false } = {}) {
    let aktMod = mod;
    let cs = fak[aktMod];
    let gyokerKezdet = 0;
    const ertekek2 = {};
    if (!cs) return { ok: false, hiba: "ervenytelen", oszlop: tokenek[0] ? tokenek[0].kezdet : 0, tokenIndex: 0, mod, ertekek: ertekek2, gyokerKezdet };
    let i = 0;
    while (i < tokenek.length) {
      if (cs.tovabb) {
        aktMod = cs.tovabb;
        cs = fak[aktMod];
        gyokerKezdet = i;
        continue;
      }
      const t = tokenek[i];
      const jeloltek = kulcsszoJeloltek(cs, t.szoveg);
      if (cs.parancs && cs.parancs.nincsMeg && jeloltek.length === 0) break;
      if (jeloltek.length === 1) {
        cs = jeloltek[0].csomopont;
        i++;
        continue;
      }
      if (jeloltek.length > 1) {
        return { ok: false, hiba: "ketertelmu", tokenIndex: i, mod: aktMod, ertekek: ertekek2, gyokerKezdet };
      }
      let illett = false;
      let legjobbHiba = null;
      for (const p of cs.parameterek) {
        const tipus = PARAM_TIPUSOK[p.elem.param];
        if (megallMaradeknal && tipus.maradekot) {
          return { ok: true, cs, mod: aktMod, ertekek: ertekek2, gyokerKezdet, maradekParam: p, maradekIndex: i };
        }
        const r = tipus.illeszt(p.elem, tokenek, i, sor2, kornyezet);
        if (r.ok) {
          ertekek2[p.elem.kulcs] = r.ertek;
          cs = p.csomopont;
          i = r.kovetkezo;
          illett = true;
          break;
        }
        if (!legjobbHiba) legjobbHiba = r;
        else if (legjobbHiba.hiba === "ervenytelen" && (r.hiba !== "ervenytelen" || r.oszlop > legjobbHiba.oszlop)) legjobbHiba = r;
      }
      if (illett) continue;
      if (legjobbHiba) {
        return {
          ok: false,
          hiba: legjobbHiba.hiba,
          oszlop: legjobbHiba.oszlop,
          tokenIndex: i,
          mod: aktMod,
          ertekek: ertekek2,
          gyokerKezdet,
          felbeHagyott: legjobbHiba.hiba === "hianyos"
        };
      }
      return { ok: false, hiba: "ervenytelen", oszlop: t.kezdet, tokenIndex: i, mod: aktMod, ertekek: ertekek2, gyokerKezdet };
    }
    return { ok: true, cs, mod: aktMod, ertekek: ertekek2, gyokerKezdet, tokenIndex: i };
  }
  function illeszt(fak, mod, sor2, kornyezet = {}) {
    const tokenek = szavakra(sor2);
    const b = bejar(fak, mod, tokenek, sor2, kornyezet);
    if (!b.ok) return { ...b, tokenek };
    if (b.cs.tovabb || !b.cs.parancs) {
      return { ok: false, hiba: "hianyos", tokenIndex: tokenek.length, gyokerKezdet: b.gyokerKezdet, mod: b.mod, tokenek };
    }
    return { ok: true, parancs: b.cs.parancs, ertekek: b.ertekek, mod: b.mod, tokenek };
  }
  function sugo(fak, mod, sor2, kornyezet = {}) {
    const tokenek = szavakra(sor2);
    const reszleges = sor2 === "" || /\s$/.test(sor2) ? "" : tokenek.pop().szoveg;
    const b = bejar(fak, mod, tokenek, sor2, kornyezet, { megallMaradeknal: true });
    if (!b.ok) {
      if (b.felbeHagyott && reszleges === "") {
        return interfeszSzamSugo(tokenek, b, kornyezet) || { ...b, tokenek };
      }
      if (b.felbeHagyott && reszleges !== "") {
        const t = tokenek[b.tokenIndex];
        const ill = tipusIllesztes(t.szoveg, kornyezet.portTipusok || {});
        if (ill.tipus) {
          const szavak2 = szamReszleges(reszleges, kornyezet.portTipusok[ill.tipus]);
          if (szavak2.length) return { ok: true, fajta: "szavak", szavak: szavak2 };
        }
      }
      return { ...b, tokenek };
    }
    if (b.maradekParam) {
      return tartomanySugo(b, tokenek, reszleges, sor2, kornyezet);
    }
    let cs = b.cs;
    if (cs.tovabb) cs = fak[cs.tovabb];
    if (tokenek.length > 0 && cs.parancs && cs.parancs.nincsMeg) {
      const nincsTovabb = cs.kulcsszavak.length === 0 && cs.parameterek.length === 0;
      if (nincsTovabb) {
        const szavak2 = cs.parancs.szavak;
        return { ok: true, fajta: "lista", elemek: [{ nev: "<cr>", sugo: szavak2[szavak2.length - 1].sugo }], cr: false, gyoker: false };
      }
    }
    if (reszleges === "") {
      const elemek = [];
      for (const p of cs.parameterek) elemek.push(...PARAM_TIPUSOK[p.elem.param].sugoElemek(p.elem, kornyezet));
      const kulcsok = cs.kulcsszavak.map((k) => ({ nev: k.elem.szo, sugo: k.elem.sugo || "" }));
      kulcsok.sort((a, b2) => a.nev.localeCompare(b2.nev, "en"));
      elemek.push(...kulcsok);
      return { ok: true, fajta: "lista", elemek, cr: !!cs.parancs, gyoker: tokenek.length === 0 };
    }
    const kis = reszleges.toLowerCase();
    const szavak = cs.kulcsszavak.filter((k) => k.elem.szo.toLowerCase().startsWith(kis)).map((k) => k.elem.szo);
    szavak.sort((a, c) => a.localeCompare(c, "en"));
    for (const p of cs.parameterek) szavak.push(...PARAM_TIPUSOK[p.elem.param].reszleges(p.elem, reszleges, kornyezet));
    if (szavak.length === 0) {
      return { ok: false, hiba: "ismeretlen", tokenIndex: tokenek.length, gyokerKezdet: b.gyokerKezdet, tokenek };
    }
    return { ok: true, fajta: "szavak", szavak: [...new Set(szavak)] };
  }
  function interfeszSzamSugo(tokenek, b, kornyezet) {
    const t = tokenek[b.tokenIndex];
    if (!t) return null;
    const ill = tipusIllesztes(t.szoveg, kornyezet.portTipusok || {});
    if (!ill.tipus) return null;
    const letezok = kornyezet.portTipusok[ill.tipus];
    const elsok = [...new Set(letezok.map((s) => Number(s.split("/")[0])))].sort((a, c) => a - c);
    return {
      ok: true,
      fajta: "lista",
      elemek: [{ nev: `<${elsok[0]}-${elsok[elsok.length - 1]}>`, sugo: `${ill.tipus}-port száma (modul/port)` }],
      cr: false,
      gyoker: false
    };
  }
  function tartomanySugo(b, tokenek, reszleges, sor2, kornyezet) {
    const p = b.maradekParam;
    const tipus = PARAM_TIPUSOK[p.elem.param];
    const eddigiTokenek = tokenek.slice(b.maradekIndex);
    if (eddigiTokenek.length === 0) {
      if (reszleges === "") return { ok: true, fajta: "lista", elemek: tipus.sugoElemek(p.elem, kornyezet), cr: false, gyoker: false };
      const szavak = tipus.reszleges(p.elem, reszleges, kornyezet);
      if (szavak.length) return { ok: true, fajta: "szavak", szavak };
      return { ok: false, hiba: "ismeretlen", tokenIndex: tokenek.length, gyokerKezdet: b.gyokerKezdet, tokenek };
    }
    if (p.elem.param === "sor") {
      if (reszleges !== "") return { ok: true, fajta: "szavak", szavak: tipus.reszleges(p.elem, reszleges, kornyezet) };
      return { ok: true, fajta: "lista", elemek: tipus.sugoElemek(p.elem, kornyezet), cr: true, gyoker: false };
    }
    const kezdet = eddigiTokenek[0].kezdet;
    const vizsgalt = reszleges === "" ? sor2 : sor2.slice(0, sor2.length - reszleges.length);
    const szoveg = vizsgalt.slice(kezdet).trimEnd();
    if (reszleges === "") {
      if (/[-,]$/.test(szoveg)) {
        return { ok: true, fajta: "lista", elemek: /-$/.test(szoveg) ? [{ nev: "<1-24>", sugo: "A tartomány utolsó portja" }] : tipus.sugoElemek(p.elem, kornyezet), cr: false, gyoker: false };
      }
      const r = tartomanyElemez(szoveg, kezdet, kornyezet.portTipusok || {});
      if (!r.ok) return { ok: false, hiba: r.hiba, oszlop: r.oszlop, tokenIndex: tokenek.length, gyokerKezdet: b.gyokerKezdet, tokenek };
      return {
        ok: true,
        fajta: "lista",
        elemek: [
          { nev: "-", sugo: "Tartomány: az első és az utolsó port között mindegyik" },
          { nev: ",", sugo: "Újabb port vagy tartomány hozzáadása a listához" }
        ],
        cr: true,
        gyoker: false
      };
    }
    return { ok: true, fajta: "szavak", szavak: tipus.reszleges(p.elem, reszleges, kornyezet) };
  }
  function kiegeszit(fak, mod, sor2, kornyezet = {}) {
    if (sor2 === "" || /\s$/.test(sor2)) return null;
    const tokenek = szavakra(sor2);
    const utolso = tokenek.pop();
    const b = bejar(fak, mod, tokenek, sor2, kornyezet, { megallMaradeknal: true });
    if (!b.ok) return null;
    const eleje = sor2.slice(0, utolso.kezdet);
    if (b.maradekParam) {
      const t = PARAM_TIPUSOK[b.maradekParam.elem.param].kiegeszit(b.maradekParam.elem, utolso.szoveg, kornyezet);
      return t ? eleje + t : null;
    }
    let cs = b.cs;
    if (cs.tovabb) cs = fak[cs.tovabb];
    const jeloltek = kulcsszoJeloltek(cs, utolso.szoveg);
    if (jeloltek.length === 1) return eleje + jeloltek[0].elem.szo + " ";
    if (jeloltek.length > 1) return null;
    for (const p of cs.parameterek) {
      const t = PARAM_TIPUSOK[p.elem.param].kiegeszit(p.elem, utolso.szoveg, kornyezet);
      if (t) return eleje + t;
    }
    return null;
  }

  // src/cli/terminal-munkamenet.js
  var TORTENET_MERET = 10;
  var Munkamenet = class {
    /**
     * @param {Object} p
     * @param {Object} p.szemelyiseg – a gyártói réteg (pl. ios)
     * @param {Object} p.eszkoz      – az eszköz állapota (modell)
     * @param {Ora} [p.ora]          – szimulált óra (a naplóüzenetek időbélyegéhez)
     */
    constructor({ szemelyiseg: szemelyiseg2, eszkoz, ora }) {
      this.szemelyiseg = szemelyiseg2;
      this.eszkoz = eszkoz;
      this.ora = ora || new Ora();
      this.fak = faEpites(szemelyiseg2.parancsok);
      this.mod = szemelyiseg2.kezdoMod;
      this.kontextus = {};
      this.tortenetek = {};
      this.varakozas = null;
      this.figyelok = [];
    }
    /** Feliratkozás: minden parancs után szól (pl. a nézetnek, hogy frissítse a gépnevet). */
    figyel(fn) {
      this.figyelok.push(fn);
    }
    /** Az aktuális prompt, pl. „Switch(config)#”. */
    prompt() {
      if (this.varakozas) return this.varakozas.prompt;
      return this.szemelyiseg.modok[this.mod].prompt(this.eszkoz.hostname);
    }
    /** Az eszköz adatai, amelyekre az értelmezőnek szüksége van (pl. milyen portok vannak). */
    kornyezet() {
      return this.szemelyiseg.kornyezet(this.eszkoz);
    }
    /** Az aktuális módcsoport előzményei (a legrégebbi elöl). */
    tortenet() {
      const csoport = this.szemelyiseg.modok[this.mod].tortenet;
      return this.tortenetek[csoport] || [];
    }
    /** @private */
    tortenetbe(sor2) {
      const csoport = this.szemelyiseg.modok[this.mod].tortenet;
      const lista3 = this.tortenetek[csoport] = this.tortenetek[csoport] || [];
      if (lista3[lista3.length - 1] !== sor2) lista3.push(sor2);
      while (lista3.length > TORTENET_MERET) lista3.shift();
    }
    /**
     * A parancsoknak átadott „eszköztár”.
     * @private
     * @param {KimenetElem[]} kimenet – ide gyűlik a kiírt szöveg
     */
    ctx(kimenet) {
      const mm = this;
      return {
        eszkoz: mm.eszkoz,
        ora: mm.ora,
        get mod() {
          return mm.mod;
        },
        get kontextus() {
          return mm.kontextus;
        },
        /** Sorok kiírása. */
        kiir: (...sorok) => kimenet.push(...sorok),
        /** Időbélyeges naplóüzenet, pl. „*Mar  1 00:01:02.345: %SYS-5-…”. */
        naplo: (uzenet) => kimenet.push(`${naploIdobelyeg(mm.ora.ido)}: ${uzenet}`),
        /** Várakozás a kiírás közben (pl. névfeloldás). */
        varj: (ms) => kimenet.push({ varj: ms }),
        /** Módváltás; a személyiség „modValtasKor” része is lefut (pl. naplóüzenet). */
        modValt: (uj, kontextus = {}) => {
          const regi = mm.mod;
          mm.mod = uj;
          mm.kontextus = kontextus;
          if (mm.szemelyiseg.modValtasKor) mm.szemelyiseg.modValtasKor(regi, uj, mm.ctx(kimenet), mm);
        },
        /** Kérdés az eszköz részéről: a következő beírt sort a `valasz` kapja meg. */
        kerdez: (promptSzoveg, valasz) => {
          mm.varakozas = { prompt: promptSzoveg, valasz };
        },
        /** Az aktuális prompt (pl. a naplóüzenet előtti sorhoz). */
        prompt: () => mm.prompt()
      };
    }
    /** @private */
    ertesit() {
      for (const fn of this.figyelok) fn();
    }
    /**
     * Egy beírt sor (Enter) feldolgozása.
     * @param {string} sor
     * @returns {{kimenet: KimenetElem[], lapozhato: boolean}}
     */
    bevitel(sor2) {
      const kimenet = [];
      const ctx = this.ctx(kimenet);
      if (this.varakozas) {
        const { valasz } = this.varakozas;
        this.varakozas = null;
        valasz(sor2, ctx);
        this.ertesit();
        return { kimenet, lapozhato: false };
      }
      if (sor2.trim() === "") return { kimenet, lapozhato: false };
      this.tortenetbe(sor2);
      const kornyezet = this.kornyezet();
      const promptSzoveg = this.prompt();
      let r = illeszt(this.fak, this.mod, sor2, kornyezet);
      const visszaesik = this.szemelyiseg.modok[this.mod].visszaesik;
      if (!r.ok && visszaesik) {
        const r2 = illeszt(this.fak, visszaesik, sor2, kornyezet);
        if (r2.ok) {
          this.mod = visszaesik;
          this.kontextus = {};
          r = r2;
        } else if (r.hiba === "ervenytelen" && (r2.hiba !== "ervenytelen" || r2.oszlop > r.oszlop)) {
          r = r2;
        }
      }
      if (!r.ok) {
        const info = { sor: sor2, prompt: promptSzoveg, mod: this.mod, modAdat: this.szemelyiseg.modok[this.mod] };
        kimenet.push(...this.szemelyiseg.formazHiba(r, info));
        return { kimenet, lapozhato: false };
      }
      r.parancs.vegrehajt(ctx, r.ertekek);
      this.ertesit();
      return { kimenet, lapozhato: !!r.parancs.lapozhato };
    }
    /**
     * A ? súgó. A `sor` a ? ELŐTTI szöveg.
     * @returns {{kimenet: string[], sor: string}} – a kiírandó súgó, és a sor, amit vissza kell írni a beviteli mezőbe
     */
    sugo(sor2) {
      if (this.varakozas) return { kimenet: [], sor: sor2 };
      const kornyezet = this.kornyezet();
      let r = sugo(this.fak, this.mod, sor2, kornyezet);
      const visszaesik = this.szemelyiseg.modok[this.mod].visszaesik;
      if (!r.ok && visszaesik && sor2.trim() !== "") {
        const r2 = sugo(this.fak, visszaesik, sor2, kornyezet);
        if (r2.ok) r = r2;
      }
      const info = { sor: sor2, prompt: this.prompt(), mod: this.mod, modAdat: this.szemelyiseg.modok[this.mod] };
      return { kimenet: this.szemelyiseg.formazSugo(r, info), sor: sor2 };
    }
    /**
     * Tab-kiegészítés.
     * @returns {string|null} – a kiegészített sor, vagy null
     */
    kiegeszit(sor2) {
      if (this.varakozas) return null;
      const kornyezet = this.kornyezet();
      const r = kiegeszit(this.fak, this.mod, sor2, kornyezet);
      if (r !== null) return r;
      const visszaesik = this.szemelyiseg.modok[this.mod].visszaesik;
      return visszaesik ? kiegeszit(this.fak, visszaesik, sor2, kornyezet) : null;
    }
    /**
     * Ctrl+Z: konfigurációs módból vissza a privilegizált módba (mint az „end”).
     * @returns {{kimenet: KimenetElem[]}}
     */
    ctrlZ() {
      const kimenet = [];
      if (!this.varakozas && this.szemelyiseg.ctrlZ) {
        this.szemelyiseg.ctrlZ(this.ctx(kimenet), this);
        this.ertesit();
      }
      return { kimenet };
    }
  };

  // src/gyartok/ios/modok.js
  var MODOK = {
    felhasznalo: {
      prompt: (h) => `${h}>`,
      exec: true,
      tortenet: "exec",
      sugoFejlec: "Exec commands:"
    },
    priv: {
      prompt: (h) => `${h}#`,
      exec: true,
      tortenet: "exec",
      sugoFejlec: "Exec commands:"
    },
    konfig: {
      prompt: (h) => `${h}(config)#`,
      konfig: true,
      tortenet: "konfig",
      sugoFejlec: "Configure commands:"
    },
    "konfig-if": {
      prompt: (h) => `${h}(config-if)#`,
      konfig: true,
      visszaesik: "konfig",
      tortenet: "konfig",
      sugoFejlec: "Interface configuration commands:"
    },
    "konfig-if-tartomany": {
      prompt: (h) => `${h}(config-if-range)#`,
      konfig: true,
      visszaesik: "konfig",
      tortenet: "konfig",
      sugoFejlec: "Interface configuration commands:"
    },
    "konfig-router": {
      prompt: (h) => `${h}(config-router)#`,
      konfig: true,
      visszaesik: "konfig",
      tortenet: "konfig",
      sugoFejlec: "Router configuration commands:"
    },
    "konfig-rtr": {
      prompt: (h) => `${h}(config-rtr)#`,
      konfig: true,
      visszaesik: "konfig",
      tortenet: "konfig",
      sugoFejlec: "IPv6 RIP router configuration commands:"
    },
    "konfig-ospf": {
      prompt: (h) => `${h}(config-router)#`,
      konfig: true,
      visszaesik: "konfig",
      tortenet: "konfig",
      sugoFejlec: "Router configuration commands:"
    },
    "konfig-ospf6": {
      prompt: (h) => `${h}(config-rtr)#`,
      konfig: true,
      visszaesik: "konfig",
      tortenet: "konfig",
      sugoFejlec: "Router configuration commands:"
    },
    "konfig-vlan": {
      prompt: (h) => `${h}(config-vlan)#`,
      konfig: true,
      visszaesik: "konfig",
      tortenet: "konfig",
      sugoFejlec: "VLAN configuration commands:"
    }
  };
  var KONFIG_MODOK = Object.keys(MODOK).filter((m) => MODOK[m].konfig);
  var ALMODOK = KONFIG_MODOK.filter((m) => m !== "konfig");

  // src/gyartok/ios/uzenetek.js
  var NEVFELOLDAS_VARAKOZAS = 1500;
  function jelzoSor(prompt, oszlop) {
    return " ".repeat(prompt.length + oszlop) + "^";
  }
  function formazHiba(r, info) {
    if (r.hiba === "ketertelmu") return [`% Ambiguous command:  "${info.sor.trim()}"`];
    if (r.hiba === "hianyos") return ["% Incomplete command.", ""];
    if (info.modAdat.exec && r.gyokerKezdet === 0 && r.tokenIndex === 0) {
      if (r.tokenek.length === 1) {
        return [
          `Translating "${r.tokenek[0].szoveg}"...domain server (255.255.255.255)`,
          { varj: NEVFELOLDAS_VARAKOZAS },
          "% Unknown command or computer name, or unable to find computer address"
        ];
      }
      return [jelzoSor(info.prompt, r.tokenek[1].kezdet), "% Invalid input detected at '^' marker.", ""];
    }
    return [jelzoSor(info.prompt, r.oszlop || 0), "% Invalid input detected at '^' marker.", ""];
  }
  function formazSugo(r, info) {
    if (!r.ok) {
      if (r.hiba === "ismeretlen" || r.hiba === "ervenytelen" && r.tokenIndex === 0) return ["% Unrecognized command"];
      if (r.hiba === "ketertelmu") return [`% Ambiguous command:  "${info.sor.trim()}"`];
      if (r.hiba === "hianyos") return ["% Incomplete command.", ""];
      return [jelzoSor(info.prompt, r.oszlop || 0), "% Invalid input detected at '^' marker.", ""];
    }
    if (r.fajta === "szavak") {
      const szel2 = Math.max(...r.szavak.map((s) => s.length)) + 2;
      const egySorban = Math.max(1, Math.floor(80 / szel2));
      const sorok2 = [];
      for (let i = 0; i < r.szavak.length; i += egySorban) {
        sorok2.push(r.szavak.slice(i, i + egySorban).map((s) => s.padEnd(szel2)).join("").trimEnd());
      }
      return [...sorok2, ""];
    }
    const sorok = [];
    if (r.gyoker && info.modAdat.sugoFejlec) sorok.push(info.modAdat.sugoFejlec);
    const szel = Math.max(0, ...r.elemek.map((e) => e.nev.length));
    for (const e of r.elemek) sorok.push(`  ${e.nev.padEnd(szel)}  ${e.sugo}`.trimEnd());
    if (r.cr) sorok.push("  <cr>");
    sorok.push("");
    return sorok;
  }

  // src/mag/ethernet.js
  var SZORAS = "ffffffffffff";
  var kovetkezoAzon = 1;
  function ujKeretAzon() {
    return kovetkezoAzon++;
  }
  function macNevbol(nev) {
    let h = 2166136261;
    for (let i = 0; i < nev.length; i++) {
      h ^= nev.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    const kever = (x) => {
      x ^= x >>> 16;
      x = Math.imul(x, 2246822507) >>> 0;
      x ^= x >>> 13;
      x = Math.imul(x, 3266489909) >>> 0;
      x ^= x >>> 16;
      return x >>> 0;
    };
    const a = kever(h);
    const b = kever(a ^ 2654435769);
    return "02" + a.toString(16).padStart(8, "0") + (b & 255).toString(16).padStart(2, "0");
  }
  function macPontos(mac) {
    return `${mac.slice(0, 4)}.${mac.slice(4, 8)}.${mac.slice(8, 12)}`;
  }
  function macKotojeles(mac) {
    return mac.toUpperCase().match(/../g).join("-");
  }

  // src/modell/switch.js
  var ALAP_HOSTNAME = "Switch";
  function gyariVlanok() {
    return {
      1: { nev: "default", gyari: true, tamogatott: true },
      1002: { nev: "fddi-default", gyari: true, tamogatott: false },
      1003: { nev: "token-ring-default", gyari: true, tamogatott: false },
      1004: { nev: "fddinet-default", gyari: true, tamogatott: false },
      1005: { nev: "trnet-default", gyari: true, tamogatott: false }
    };
  }
  var ROVID_TIPUSNEV = { FastEthernet: "Fa", GigabitEthernet: "Gi" };
  function ujPort(tipus, szam) {
    return {
      nev: tipus + szam,
      rovid: ROVID_TIPUSNEV[tipus] + szam,
      tipus,
      szam,
      leallitva: false,
      accessVlan: 1,
      mod: "dinamikus-auto",
      nativVlan: 1,
      fent: false
    };
  }
  function ujSwitch2960(beallitasok = {}) {
    const portok = [];
    for (let i = 1; i <= 24; i++) portok.push(ujPort("FastEthernet", `0/${i}`));
    for (let i = 1; i <= 2; i++) portok.push(ujPort("GigabitEthernet", `0/${i}`));
    return {
      tipus: "switch",
      modell: "2960-24",
      hostname: beallitasok.hostname || ALAP_HOSTNAME,
      vtpMod: "server",
      vlanok: gyariVlanok(),
      portok,
      macTabla: [],
      mac: macNevbol("switch:" + (beallitasok.hostname || ALAP_HOSTNAME)),
      vtpTartomany: "",
      vtpJelszo: "",
      vtpVerzio: 1,
      vtpRevizio: 0,
      vtpModositva: null,
      vtpMd5Hiba: null
    };
  }
  function portKeres(sw, nev) {
    return sw.portok.find((p) => p.nev === nev);
  }
  function portTipusok(sw) {
    const eredmeny = {};
    for (const p of sw.portok) {
      (eredmeny[p.tipus] = eredmeny[p.tipus] || []).push(p.szam);
    }
    return eredmeny;
  }
  function alapVlanNev(szam) {
    return "VLAN" + String(szam).padStart(4, "0");
  }

  // src/gyartok/ios/parancsok/alap.js
  var SZO = {
    no: { szo: "no", sugo: "Parancs visszavonása, alapérték visszaállítása" }
  };
  function kijelentkezes(ctx) {
    ctx.kiir("", `${ctx.eszkoz.hostname} con0 is now available`, "", "", "", "", "", "Press RETURN to get started.", "");
    ctx.modValt("felhasznalo");
    ctx.kerdez("", () => {
    });
  }
  function konfigBe(ctx) {
    ctx.kiir("Enter configuration commands, one per line.  End with CNTL/Z.");
    ctx.modValt("konfig");
  }
  function ervenyesGepnev(nev) {
    return /^[A-Za-z][\x21-\x7e]*$/.test(nev);
  }
  var alapParancsok = [
    // ---------- felhasználói és privilegizált mód ----------
    {
      modok: ["felhasznalo", "priv"],
      szavak: [{ szo: "enable", sugo: "Belépés privilegizált (rendszergazdai) módba" }],
      vegrehajt(ctx) {
        if (ctx.mod === "felhasznalo") ctx.modValt("priv");
      }
    },
    {
      modok: ["priv"],
      szavak: [{ szo: "disable", sugo: "Vissza a felhasználói módba" }],
      vegrehajt(ctx) {
        ctx.modValt("felhasznalo");
      }
    },
    {
      modok: ["felhasznalo", "priv"],
      szavak: [{ szo: "exit", sugo: "Kilépés az eszközről (a munkamenet bezárása)" }],
      vegrehajt: kijelentkezes
    },
    {
      modok: ["felhasznalo", "priv"],
      szavak: [{ szo: "logout", sugo: "Kilépés az eszközről (ugyanaz, mint az exit)" }],
      vegrehajt: kijelentkezes
    },
    {
      modok: ["priv"],
      szavak: [
        { szo: "configure", sugo: "Belépés konfigurációs módba" },
        { szo: "terminal", sugo: "Beállítás innen, a parancssorból" }
      ],
      vegrehajt: konfigBe
    },
    {
      // Csak „configure”: az eszköz megkérdezi, honnan jön a konfiguráció.
      modok: ["priv"],
      szavak: [{ szo: "configure", sugo: "Belépés konfigurációs módba" }],
      vegrehajt(ctx) {
        ctx.kerdez("Configuring from terminal, memory, or network [terminal]? ", (valasz, c) => {
          const v = valasz.trim().toLowerCase();
          if (v === "" || "terminal".startsWith(v)) konfigBe(c);
          else if ("memory".startsWith(v) || "network".startsWith(v)) c.kiir("[Szimulátor] Ez a lehetőség a szimulátorban még nincs meg.");
          else c.kiir('?Must be "terminal", "memory" or "network"');
        });
      }
    },
    // ---------- konfigurációs módok ----------
    {
      modok: ["konfig"],
      szavak: [{ szo: "exit", sugo: "Kilépés a konfigurációs módból" }],
      vegrehajt(ctx) {
        ctx.modValt("priv");
      }
    },
    {
      modok: ALMODOK,
      szavak: [{ szo: "exit", sugo: "Kilépés ebből az almódból (vissza a konfigurációs módba)" }],
      vegrehajt(ctx) {
        ctx.modValt("konfig");
      }
    },
    {
      modok: KONFIG_MODOK,
      szavak: [{ szo: "end", sugo: "Kilépés a konfigurációból, vissza a privilegizált módba" }],
      vegrehajt(ctx) {
        ctx.modValt("priv");
      }
    },
    {
      modok: KONFIG_MODOK,
      szavak: [{ szo: "do", sugo: "Privilegizált módú parancs futtatása (pl. do show vlan brief)" }, { tovabb: "priv" }]
    },
    {
      modok: ["konfig"],
      szavak: [
        { szo: "hostname", sugo: "Az eszköz nevének beállítása" },
        { param: "szo", kulcs: "nev", sugo: "Az eszköz új neve" }
      ],
      vegrehajt(ctx, { nev }) {
        if (!ervenyesGepnev(nev)) {
          ctx.kiir("% Hostname contains one or more illegal characters.");
          return;
        }
        ctx.eszkoz.hostname = nev.slice(0, 63);
      }
    },
    {
      modok: ["konfig"],
      szavak: [SZO.no, { szo: "hostname", sugo: "Az eszköz nevének visszaállítása az alapértékre" }],
      vegrehajt(ctx) {
        ctx.eszkoz.hostname = ALAP_HOSTNAME;
      }
    }
  ];

  // src/magyar.js
  var EGYES = ["", "es", "es", "as", "es", "ös", "os", "es", "as", "es"];
  var TIZES = ["", "es", "as", "as", "es", "es", "as", "es", "as", "es"];
  function esRag(n) {
    const x = Math.abs(Math.trunc(Number(n)));
    let rag;
    if (x === 0) rag = "s";
    else if (x % 10 !== 0) rag = EGYES[x % 10];
    else if (x % 100 !== 0) rag = TIZES[x % 100 / 10];
    else if (x % 1e3 !== 0) rag = "as";
    else rag = "es";
    return `${n}-${rag}`;
  }
  function nevelo(n) {
    const s = String(Math.abs(Math.trunc(Number(n))));
    if (s === "1" || s[0] === "5") return "az";
    if (s.length === 4 && s[0] === "1") return "az";
    return "a";
  }

  // src/mag/kapcsolas.js
  var MAC_ELETKOR = 3e5;
  function uzemmod(sw, port2) {
    if (port2.mod === "trunk") return "trunk";
    if (port2.mod === "access") return "access";
    if (!port2.fent || !sw.halozat) return "access";
    const tul = sw.halozat.szomszed(sw, port2);
    if (!tul || tul.eszkoz.tipus !== "switch") return "access";
    const m = tul.port.mod;
    const t1 = sw.vtpTartomany;
    const t2 = tul.eszkoz.vtpTartomany;
    if (t1 && t2 && t1 !== t2 && m !== "trunk") return "access";
    if (port2.mod === "dinamikus-auto") return m === "trunk" || m === "dinamikus-kezdemenyezo" ? "trunk" : "access";
    if (port2.mod === "dinamikus-kezdemenyezo") return m === "access" ? "access" : "trunk";
    return "access";
  }
  function vlanAktiv(sw, vlan) {
    const v = sw.vlanok[vlan];
    return !!v && v.tamogatott !== false;
  }
  function portTagja(sw, port2, vlan) {
    if (uzemmod(sw, port2) === "trunk") return vlanAktiv(sw, vlan);
    return port2.accessVlan === vlan;
  }
  function macTabla(sw) {
    const ido = sw.halozat ? sw.halozat.ora.ido : 0;
    sw.macTabla = (sw.macTabla || []).filter((b) => ido - b.ido < MAC_ELETKOR);
    return sw.macTabla;
  }
  function macTorolPort(sw, portNev) {
    sw.macTabla = (sw.macTabla || []).filter((b) => b.port !== portNev);
  }
  function macTanul(sw, vlan, mac, portNev, ido) {
    const t = macTabla(sw);
    const b = t.find((x) => x.vlan === vlan && x.mac === mac);
    if (b) {
      b.port = portNev;
      b.ido = ido;
    } else {
      t.push({ vlan, mac, port: portNev, ido });
    }
  }
  function kapcsoloFogad(h, sw, port2, keret2) {
    if (keret2.tipus === "vtp") return vtpFogad(h, sw, port2, keret2);
    let vlan;
    if (uzemmod(sw, port2) === "trunk") {
      vlan = keret2.vlan !== void 0 ? keret2.vlan : port2.nativVlan;
    } else {
      if (keret2.vlan !== void 0) return h.eldob(sw, port2, keret2, "Címkés (802.1Q) keret érkezett egy access portra.");
      vlan = port2.accessVlan;
    }
    if (!vlanAktiv(sw, vlan)) {
      return h.eldob(sw, port2, keret2, `${nevelo(vlan) === "az" ? "Az" : "A"} ${esRag(vlan)} VLAN nem létezik ezen a switchen (${sw.hostname}), ezért a keretet eldobta.`);
    }
    if (keret2.forrasMac !== SZORAS) macTanul(sw, vlan, keret2.forrasMac, port2.nev, h.ora.ido);
    let kimenok;
    const ismert = keret2.celMac !== SZORAS && macTabla(sw).find((b) => b.vlan === vlan && b.mac === keret2.celMac);
    if (ismert) {
      if (ismert.port === port2.nev) return;
      kimenok = sw.portok.filter((p) => p.nev === ismert.port);
    } else {
      kimenok = sw.portok.filter((p) => p !== port2);
    }
    for (const p of kimenok) {
      if (!p.fent || !portTagja(sw, p, vlan)) continue;
      const trunk = uzemmod(sw, p) === "trunk";
      const cimke = trunk && vlan !== p.nativVlan ? vlan : void 0;
      h.kuld(sw, p, { ...keret2, vlan: cimke });
    }
  }

  // src/mag/vtp.js
  var VTP_IDOKOZ = 3e5;
  var VTP_MAC = "01000ccccccc";
  function kivonat(szoveg) {
    let h1 = 2166136261;
    let h2 = 16777619;
    for (let i = 0; i < szoveg.length; i++) {
      const c = szoveg.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 ^ c, 1540483477) >>> 0;
    }
    return [h1, h2, Math.imul(h1 ^ h2, 2246822507) >>> 0, Math.imul(h2 + 2654435769, 3266489909) >>> 0];
  }
  function jelszoKivonat(jelszo) {
    return kivonat("jelszo:" + jelszo).join("-");
  }
  function vtpVlanok(sw) {
    const v = {};
    for (const [szam, adat] of Object.entries(sw.vlanok)) if (!adat.gyari) v[szam] = adat.nev;
    return v;
  }
  function vtpMd5(sw) {
    const szoveg = JSON.stringify([sw.vtpTartomany, sw.vtpJelszo, sw.vtpRevizio, vtpVlanok(sw)]);
    const bajtok = [];
    for (const sz of kivonat(szoveg)) for (let i = 0; i < 4; i++) bajtok.push(sz >>> 24 - 8 * i & 255);
    return bajtok;
  }
  function trunkPortok(sw) {
    return sw.portok.filter((p) => p.fent && uzemmod(sw, p) === "trunk");
  }
  function hirdethet(sw) {
    return !!sw.halozat && !!sw.vtpTartomany && sw.vtpMod !== "transparent";
  }
  function keret(sw, keres) {
    return {
      forrasMac: sw.mac,
      celMac: VTP_MAC,
      tipus: "vtp",
      adat: {
        kuldo: sw.hostname,
        tartomany: sw.vtpTartomany,
        revizio: sw.vtpRevizio,
        verzio: sw.vtpVerzio,
        jelszoKivonat: jelszoKivonat(sw.vtpJelszo),
        vlanok: vtpVlanok(sw),
        keres
      }
    };
  }
  function vtpHirdet(sw, { keres = false, kiveve = null, csak = null } = {}) {
    if (!hirdethet(sw)) return;
    const portok = csak ? [csak] : trunkPortok(sw).filter((p) => p !== kiveve);
    for (const p of portok) sw.halozat.kuld(sw, p, keret(sw, keres));
  }
  function vtpVlanValtozas(sw) {
    if (sw.vtpMod === "transparent") return;
    sw.vtpRevizio++;
    sw.vtpModositva = sw.halozat ? sw.halozat.ora.ido : 0;
    vtpHirdet(sw);
    if (sw.halozat) sw.halozat.esemeny({ tipus: "allapot" });
  }
  function vtpBeallitasValtozas(sw) {
    vtpHirdet(sw, { keres: true });
  }
  function vtpTrunkValtozas(sw, port2) {
    if (!sw.halozat) return;
    const tul = sw.halozat.szomszed(sw, port2);
    for (const [e, p] of [[sw, port2], tul ? [tul.eszkoz, tul.port] : [null, null]]) {
      if (e && e.tipus === "switch" && p.fent && uzemmod(e, p) === "trunk") vtpHirdet(e, { keres: true, csak: p });
    }
  }
  function atvesz(sw, a) {
    for (const szam of Object.keys(sw.vlanok)) {
      if (!sw.vlanok[szam].gyari && !(szam in a.vlanok)) delete sw.vlanok[szam];
    }
    for (const [szam, nev] of Object.entries(a.vlanok)) {
      const v = sw.vlanok[szam];
      if (v && v.gyari) continue;
      sw.vlanok[szam] = { nev: nev || alapVlanNev(szam), gyari: false, tamogatott: true };
    }
    sw.vtpRevizio = a.revizio;
    if (a.verzio === 2) sw.vtpVerzio = 2;
    sw.vtpModositva = sw.halozat.ora.ido;
  }
  function vtpFogad(h, sw, port2, k) {
    if (uzemmod(sw, port2) !== "trunk") return;
    const a = k.adat;
    if (sw.vtpMod === "transparent") {
      if (sw.vtpVerzio === 2 || a.tartomany === sw.vtpTartomany) {
        for (const p of trunkPortok(sw)) if (p !== port2) h.kuld(sw, p, k);
      }
      return;
    }
    if (!sw.vtpTartomany && a.tartomany) {
      sw.vtpTartomany = a.tartomany;
    }
    if (a.tartomany !== sw.vtpTartomany) return;
    if (a.jelszoKivonat !== jelszoKivonat(sw.vtpJelszo)) {
      sw.vtpMd5Hiba = port2.rovid;
      return h.eldob(sw, port2, k, `A VTP-hirdetés jelszava nem egyezik (${sw.hostname}), ezért nem fogadta el.`);
    }
    sw.vtpMd5Hiba = null;
    if (a.revizio > sw.vtpRevizio) {
      atvesz(sw, a);
      h.esemeny({ tipus: "allapot" });
      vtpHirdet(sw, { kiveve: port2 });
    } else if (a.revizio < sw.vtpRevizio || a.keres) {
      vtpHirdet(sw, { csak: port2 });
    }
  }
  function vtpIdozitoIndit(h) {
    const kor2 = () => {
      for (const e of h.eszkozok) if (e.tipus === "switch") vtpHirdet(e);
      h.ora.utemez(VTP_IDOKOZ, kor2);
    };
    h.ora.utemez(VTP_IDOKOZ, kor2);
  }

  // src/gyartok/ios/parancsok/vlan.js
  var VLAN_SZO = { szo: "vlan", sugo: "VLAN létrehozása vagy szerkesztése" };
  var VLAN_SZAM = { param: "szam", kulcs: "vlan", min: 1, max: 4094, sugo: "A VLAN száma" };
  var KITERJESZTETT_TOL = 1006;
  function kliensTiltas(ctx) {
    if (ctx.eszkoz.vtpMod !== "client") return false;
    ctx.kiir("VTP VLAN configuration not allowed when device is in CLIENT mode.");
    return true;
  }
  var vlanParancsok = [
    {
      modok: ["konfig"],
      szavak: [VLAN_SZO, VLAN_SZAM],
      vegrehajt(ctx, { vlan }) {
        const sw = ctx.eszkoz;
        if (kliensTiltas(ctx)) return;
        if (vlan >= KITERJESZTETT_TOL && sw.vtpMod !== "transparent") {
          ctx.kiir("Extended VLAN(s) not allowed in current VTP mode.", "%Failed to commit extended VLAN(s) changes.");
          return;
        }
        if (!sw.vlanok[vlan]) {
          sw.vlanok[vlan] = { nev: alapVlanNev(vlan), gyari: false, tamogatott: true };
          vtpVlanValtozas(sw);
        }
        ctx.modValt("konfig-vlan", { vlan });
      }
    },
    {
      modok: ["konfig"],
      szavak: [SZO.no, { szo: "vlan", sugo: "VLAN törlése" }, VLAN_SZAM],
      vegrehajt(ctx, { vlan }) {
        const sw = ctx.eszkoz;
        if (kliensTiltas(ctx)) return;
        const v = sw.vlanok[vlan];
        if (v && v.gyari) {
          ctx.kiir(`%Default VLAN ${vlan} may not be deleted.`);
          return;
        }
        if (!v) return;
        delete sw.vlanok[vlan];
        vtpVlanValtozas(sw);
      }
    },
    {
      modok: ["konfig-vlan"],
      szavak: [
        { szo: "name", sugo: "A VLAN nevének megadása" },
        { param: "szo", kulcs: "nev", maxHossz: 32, sugo: "A VLAN neve (legfeljebb 32 karakter, szóköz nélkül)" }
      ],
      vegrehajt(ctx, { nev }) {
        const szam = ctx.kontextus.vlan;
        const v = ctx.eszkoz.vlanok[szam];
        if (v.gyari) {
          ctx.kiir(`%Default VLAN ${szam} may not have its name changed.`);
          return;
        }
        if (v.nev === nev) return;
        v.nev = nev;
        vtpVlanValtozas(ctx.eszkoz);
      }
    },
    {
      modok: ["konfig-vlan"],
      szavak: [SZO.no, { szo: "name", sugo: "A VLAN nevének visszaállítása (VLANxxxx)" }],
      vegrehajt(ctx) {
        const szam = ctx.kontextus.vlan;
        const v = ctx.eszkoz.vlanok[szam];
        if (!v.gyari && v.nev !== alapVlanNev(szam)) {
          v.nev = alapVlanNev(szam);
          vtpVlanValtozas(ctx.eszkoz);
        }
      }
    }
  ];

  // src/mag/vegpont.js
  var ARP_VARAKOZAS = 3e3;
  var PING_VARAKOZAS = 4e3;
  var ALAP_TTL = 128;
  var belso = /* @__PURE__ */ new WeakMap();
  function allapot(pc) {
    let a = belso.get(pc);
    if (!a) belso.set(pc, a = { arpVarok: /* @__PURE__ */ new Map(), ndVarok: /* @__PURE__ */ new Map(), pingVarok: /* @__PURE__ */ new Map(), kovetkezoSorszam: 1 });
    return a;
  }
  function nic(pc) {
    return pc.portok[0];
  }
  function kuld(h, pc, keret2) {
    h.kuld(pc, nic(pc), { azon: ujKeretAzon(), forrasMac: pc.mac, ...keret2 });
  }
  function vanIp(pc) {
    return !!pc.ip && !!pc.maszk;
  }
  function vanIpv6(pc) {
    return !!pc.ipv6;
  }
  function pcLinkLocal(pc) {
    return ipv6Szoveg(eui64LinkLocal(pc.mac));
  }
  function kovetkezoUgras(pc, celIp) {
    if (celIp.includes(":")) return kovetkezoUgras6(pc, celIp);
    if (egyHalozat(pc.ip, celIp, pc.maszk)) return celIp;
    if (pc.atjaro && egyHalozat(pc.ip, pc.atjaro, pc.maszk)) return pc.atjaro;
    return null;
  }
  function kovetkezoUgras6(pc, cel) {
    const c = ipv6Elemez(cel);
    if (linkLocalE(c)) return cel;
    if (pc.ipv6 && ipv6EgyHalozat(ipv6Elemez(pc.ipv6), c, pc.ipv6Hossz || 64)) return cel;
    return pc.ipv6Atjaro || null;
  }
  function sajat6(pc, cim) {
    return cim === pc.ipv6 || cim === pcLinkLocal(pc);
  }
  function arpFelold(h, pc, ip, cb) {
    if (ip.includes(":")) return ndFelold(h, pc, ip, cb);
    const b = pc.arpTabla[ip];
    if (b) return cb(b.mac);
    const a = allapot(pc);
    const var_ = a.arpVarok.get(ip);
    if (var_) {
      var_.cbk.push(cb);
      return;
    }
    const uj = { cbk: [cb], idozito: null };
    a.arpVarok.set(ip, uj);
    uj.idozito = h.ora.utemez(ARP_VARAKOZAS, () => {
      a.arpVarok.delete(ip);
      for (const f of uj.cbk) f(null);
    });
    kuld(h, pc, {
      celMac: SZORAS,
      tipus: "arp",
      adat: { muvelet: "keres", kuldoMac: pc.mac, kuldoIp: pc.ip, celMac: "000000000000", celIp: ip }
    });
  }
  function ndFelold(h, pc, cim, cb) {
    const b = pc.ndTabla[cim];
    if (b) return cb(b.mac);
    const a = allapot(pc);
    const var_ = a.ndVarok.get(cim);
    if (var_) {
      var_.cbk.push(cb);
      return;
    }
    const uj = { cbk: [cb], idozito: null };
    a.ndVarok.set(cim, uj);
    uj.idozito = h.ora.utemez(ARP_VARAKOZAS, () => {
      a.ndVarok.delete(cim);
      for (const f of uj.cbk) f(null);
    });
    const sn = solicitedNode(ipv6Elemez(cim));
    kuld(h, pc, {
      celMac: ipv6CsoportMac(sn),
      tipus: "ipv6",
      adat: { forras: pcLinkLocal(pc), cel: ipv6Szoveg(sn), hop: 255, protokoll: "icmpv6", icmp: { tipus: "ns", cel: cim }, keses: 0 }
    });
  }
  function arpTanul(h, pc, ip, mac) {
    pc.arpTabla[ip] = { mac, ido: h.ora.ido };
    const a = allapot(pc);
    const var_ = a.arpVarok.get(ip);
    if (var_) {
      a.arpVarok.delete(ip);
      h.ora.lemond(var_.idozito);
      for (const f of var_.cbk) f(mac);
    }
  }
  function ndTanul(h, pc, cim, mac) {
    pc.ndTabla[cim] = { mac, ido: h.ora.ido };
    const a = allapot(pc);
    const var_ = a.ndVarok.get(cim);
    if (var_) {
      a.ndVarok.delete(cim);
      h.ora.lemond(var_.idozito);
      for (const f of var_.cbk) f(mac);
    }
  }
  function ipKuld(h, pc, celIp, adat, hibaCb) {
    const v6 = celIp.includes(":");
    const ugras = kovetkezoUgras(pc, celIp);
    if (!ugras) return hibaCb && hibaCb("nincs-ut");
    arpFelold(h, pc, ugras, (mac) => {
      if (!mac) return hibaCb && hibaCb("arp");
      if (v6) {
        const forras = linkLocalE(ipv6Elemez(celIp)) ? pcLinkLocal(pc) : pc.ipv6;
        kuld(h, pc, { celMac: mac, tipus: "ipv6", adat: { forras, cel: celIp, hop: ALAP_TTL, keses: 0, ...adat } });
      } else {
        kuld(h, pc, { celMac: mac, tipus: "ipv4", adat: { forrasIp: pc.ip, celIp, ttl: ALAP_TTL, keses: 0, ...adat } });
      }
    });
  }
  function egyPing(h, pc, celIp, cb, { ttl = ALAP_TTL } = {}) {
    const v6 = celIp.includes(":");
    const cel = v6 ? ipv6Normal(celIp) : celIp;
    if (!nic(pc).fent) return cb({ fajta: "hiba" });
    if (v6) {
      if (!cel) return cb({ fajta: "hiba" });
      if (sajat6(pc, cel)) return cb({ fajta: "valasz", ttl: ALAP_TTL, keses: 0 });
      if (!vanIpv6(pc) && !linkLocalE(ipv6Elemez(cel))) return cb({ fajta: "hiba" });
    } else {
      if (!vanIp(pc)) return cb({ fajta: "hiba" });
      if (cel === pc.ip) return cb({ fajta: "valasz", ttl: ALAP_TTL, keses: 0 });
    }
    const a = allapot(pc);
    const sorszam = a.kovetkezoSorszam++;
    let kesz = false;
    const vege = (e) => {
      if (kesz) return;
      kesz = true;
      a.pingVarok.delete(sorszam);
      cb(e);
    };
    const ugras = kovetkezoUgras(pc, cel);
    if (!ugras) return vege({ fajta: "hiba" });
    arpFelold(h, pc, ugras, (mac) => {
      if (!mac) return vege({ fajta: "elerhetetlen" });
      const idozito = h.ora.utemez(PING_VARAKOZAS, () => vege({ fajta: "idotullepes" }));
      a.pingVarok.set(sorszam, (v) => {
        h.ora.lemond(idozito);
        vege(v);
      });
      if (v6) {
        const forras = linkLocalE(ipv6Elemez(cel)) ? pcLinkLocal(pc) : pc.ipv6;
        kuld(h, pc, {
          celMac: mac,
          tipus: "ipv6",
          adat: { forras, cel, hop: ttl, protokoll: "icmpv6", icmp: { tipus: "echo-keres", sorszam }, keses: 0 }
        });
      } else {
        kuld(h, pc, {
          celMac: mac,
          tipus: "ipv4",
          adat: { forrasIp: pc.ip, celIp: cel, ttl, protokoll: "icmp", icmp: { tipus: "echo-keres", sorszam }, keses: 0 }
        });
      }
    });
  }
  function szorasProba(h, pc, cb) {
    const azon = ujKeretAzon();
    const kik = [];
    const leiratkozas = h.figyel((e) => {
      if (e.tipus === "fogadva" && e.keret.azon === azon && !kik.includes(e.eszkoz)) kik.push(e.eszkoz);
    });
    h.kuld(pc, nic(pc), {
      azon,
      forrasMac: pc.mac,
      celMac: SZORAS,
      tipus: "arp",
      adat: { muvelet: "keres", kuldoMac: pc.mac, kuldoIp: "0.0.0.0", celMac: "000000000000", celIp: pc.ip || "0.0.0.0" }
    });
    h.ora.utemez(h.kesleltetes * 12 + 50, () => {
      leiratkozas();
      cb(kik);
    });
  }
  function pingnek(pc, icmp, kitol, ttl, keses) {
    const a = allapot(pc);
    if (icmp.tipus === "echo-valasz") {
      const v2 = a.pingVarok.get(icmp.sorszam);
      if (v2) v2({ fajta: "valasz", ttl, kitol, keses });
      return;
    }
    const v = icmp.eredeti && a.pingVarok.get(icmp.eredeti.sorszam);
    if (!v) return;
    if (icmp.tipus === "ido-lejart") v({ fajta: "ttl-lejart", kitol, keses });
    else if (icmp.tipus === "elerhetetlen") v({ fajta: "halozat-elerhetetlen", kitol, keses });
  }
  function vegpontFogad(h, pc, port2, keret2) {
    if (keret2.vlan !== void 0) return h.eldob(pc, port2, keret2, "A PC nem ismeri a 802.1Q-címkés keretet.");
    const csoport = keret2.celMac.startsWith("3333");
    if (keret2.celMac !== pc.mac && keret2.celMac !== SZORAS && !csoport) return;
    if (keret2.tipus === "ipv6") return ipv6Fogad(h, pc, port2, keret2);
    if (csoport) return;
    h.esemeny({ tipus: "fogadva", eszkoz: pc, port: port2, keret: keret2 });
    if (keret2.tipus === "arp") {
      const arp = keret2.adat;
      if (!vanIp(pc) || arp.kuldoIp === "0.0.0.0") return;
      if (arp.celIp !== pc.ip) return;
      arpTanul(h, pc, arp.kuldoIp, arp.kuldoMac);
      if (arp.muvelet === "keres") {
        kuld(h, pc, {
          celMac: arp.kuldoMac,
          tipus: "arp",
          adat: { muvelet: "valasz", kuldoMac: pc.mac, kuldoIp: pc.ip, celMac: arp.kuldoMac, celIp: arp.kuldoIp }
        });
      }
      return;
    }
    if (keret2.tipus === "ipv4") {
      const ip = keret2.adat;
      if (!vanIp(pc) || ip.celIp !== pc.ip) return;
      if (ip.protokoll === "icmp" && ip.icmp.tipus === "echo-keres") {
        ipKuld(h, pc, ip.forrasIp, { protokoll: "icmp", icmp: { tipus: "echo-valasz", sorszam: ip.icmp.sorszam }, keses: ip.keses || 0 });
      } else if (ip.protokoll === "icmp") {
        pingnek(pc, ip.icmp, ip.forrasIp, ip.ttl, ip.keses || 0);
      }
    }
  }
  function ipv6Fogad(h, pc, port2, keret2) {
    const cs = keret2.adat;
    if (cs.protokoll === "icmpv6" && cs.icmp.tipus === "ns") {
      if (!sajat6(pc, cs.icmp.cel)) return;
      h.esemeny({ tipus: "fogadva", eszkoz: pc, port: port2, keret: keret2 });
      ndTanul(h, pc, cs.forras, keret2.forrasMac);
      kuld(h, pc, {
        celMac: keret2.forrasMac,
        tipus: "ipv6",
        adat: { forras: cs.icmp.cel, cel: cs.forras, hop: 255, protokoll: "icmpv6", icmp: { tipus: "na", cel: cs.icmp.cel }, keses: 0 }
      });
      return;
    }
    if (!sajat6(pc, cs.cel)) return;
    h.esemeny({ tipus: "fogadva", eszkoz: pc, port: port2, keret: keret2 });
    if (cs.protokoll !== "icmpv6") return;
    if (cs.icmp.tipus === "na") {
      ndTanul(h, pc, cs.icmp.cel, keret2.forrasMac);
      return;
    }
    if (cs.icmp.tipus === "echo-keres") {
      ipKuld(h, pc, cs.forras, { protokoll: "icmpv6", icmp: { tipus: "echo-valasz", sorszam: cs.icmp.sorszam }, keses: cs.keses || 0 });
      return;
    }
    pingnek(pc, cs.icmp, cs.forras, cs.hop, cs.keses || 0);
  }
  function ipBeallit(pc, { ip, maszk, atjaro, ipv6, ipv6Hossz, ipv6Atjaro }) {
    if (ip !== void 0) pc.ip = ip;
    if (maszk !== void 0) pc.maszk = maszk;
    if (atjaro !== void 0) pc.atjaro = atjaro;
    if (ipv6 !== void 0) pc.ipv6 = ipv6 ? ipv6Normal(ipv6) || "" : "";
    if (ipv6Hossz !== void 0) pc.ipv6Hossz = ipv6Hossz;
    if (ipv6Atjaro !== void 0) pc.ipv6Atjaro = ipv6Atjaro ? ipv6Normal(ipv6Atjaro) || "" : "";
    pc.arpTabla = {};
    pc.ndTabla = {};
  }

  // src/mag/rip.js
  var VEGTELEN = 16;
  var UZENET_MERET = 25;
  var MAX_UT = 4;
  var RIPNG_IDOZITOK = { frissites: 30, ervenytelen: 180, visszatartas: 0, torles: 120 };
  var VILLAM_KESES = 1e3;
  var belso2 = /* @__PURE__ */ new WeakMap();
  function ujCsaladAllapot() {
    return {
      /** kulcs → { halozat, hossz, metrika, utak: [{kovetkezo, port, ido}], le, leKezd, utolsoJo, eloMetrika } */
      db: /* @__PURE__ */ new Map(),
      /** port neve → Map(kulcs → metrika): amit legutóbb ott hirdetett (a poisoninghoz és a változásokhoz) */
      hirdetett: /* @__PURE__ */ new Map(),
      /** szomszéd címe → utolsó frissítés ideje */
      forrasok: /* @__PURE__ */ new Map(),
      kovetkezo: null,
      villam: null,
      periodikus: 0,
      valtozasra: 0
    };
  }
  function all(r, csalad) {
    let a = belso2.get(r);
    if (!a) belso2.set(r, a = { 4: ujCsaladAllapot(), 6: ujCsaladAllapot() });
    return a[csalad];
  }
  function most(r) {
    return r.halozat ? r.halozat.ora.ido : 0;
  }
  function naplo(r, ...sorok) {
    if (!r.halozat) return;
    for (const s of sorok) r.halozat.naplo(r, s);
  }
  function idozitok(r, csalad) {
    const t = csalad === 4 ? r.rip ? r.rip.idozitok : { frissites: 30, ervenytelen: 180, visszatartas: 180, torles: 240 } : RIPNG_IDOZITOK;
    return { frissites: t.frissites * 1e3, ervenytelen: t.ervenytelen * 1e3, visszatartas: t.visszatartas * 1e3, torles: t.torles * 1e3 };
  }
  function ripPorton4(r, p) {
    if (!r.rip || !p.ip) return false;
    const o = osztalyos(ipSzam(p.ip)).halozat;
    return r.rip.halozatok.some((n) => ipSzam(n) === o);
  }
  function ripPorton6(r, p) {
    return !!(r.ipv6Routing && p.ripng && r.ripng[p.ripng] && ipv6Engedelyezve(p));
  }
  function porton(r, p, csalad) {
    return csalad === 4 ? ripPorton4(r, p) : ripPorton6(r, p);
  }
  function kuldhet(r, p, csalad) {
    if (!porton(r, p, csalad) || !portFent(p) || p.tipus === "Loopback") return false;
    if (csalad === 4 && r.rip.passziv.includes(p.nev)) return false;
    return true;
  }
  function ripPortok(r, csalad) {
    return r.portok.filter((p) => porton(r, p, csalad));
  }
  function aktiv(r, csalad) {
    return csalad === 4 ? !!r.rip : !!r.ipv6Routing && Object.keys(r.ripng).length > 0;
  }
  function kulcs(csalad, halozat, hossz) {
    return csalad === 4 ? `${ipSzoveg(halozat)}/${hossz}` : `${ipv6Szoveg(halozat)}/${hossz}`;
  }
  function azonosSzomszed(csalad, a, b) {
    return csalad === 4 ? a === b : ipv6Szoveg(a) === ipv6Szoveg(b);
  }
  function leTesz(r, csalad, e) {
    e.le = true;
    e.leKezd = most(r);
    e.eloMetrika = e.metrika;
    e.metrika = VEGTELEN;
    e.utak = e.utak.length ? [e.utak[0]] : e.utak;
  }
  function frissit(r, csalad, halozat, hossz, u) {
    const a = all(r, csalad);
    const k = kulcs(csalad, halozat, hossz);
    const t = idozitok(r, csalad);
    const ido = most(r);
    let e = a.db.get(k);
    const ut = { kovetkezo: u.kovetkezo, port: u.port, ido };
    if (u.metrika >= VEGTELEN) {
      if (!e || e.le) return false;
      const i2 = e.utak.findIndex((x) => x.port === u.port && azonosSzomszed(csalad, x.kovetkezo, u.kovetkezo));
      if (i2 < 0) return false;
      if (e.utak.length > 1) {
        e.utak.splice(i2, 1);
        return true;
      }
      leTesz(r, csalad, e);
      return true;
    }
    if (!e) {
      a.db.set(k, { halozat, hossz, metrika: u.metrika, utak: [ut], le: false, utolsoJo: ido });
      return true;
    }
    if (e.le) {
      if (ido < e.leKezd + t.visszatartas && u.metrika > e.eloMetrika) return false;
      Object.assign(e, { le: false, metrika: u.metrika, utak: [ut], utolsoJo: ido });
      return true;
    }
    const i = e.utak.findIndex((x) => x.port === u.port && azonosSzomszed(csalad, x.kovetkezo, u.kovetkezo));
    if (i >= 0) {
      e.utak[i].ido = ido;
      e.utolsoJo = ido;
      if (u.metrika === e.metrika) return false;
      if (u.metrika < e.metrika) {
        e.metrika = u.metrika;
        e.utak = [e.utak[i]];
        return true;
      }
      if (e.utak.length > 1) e.utak.splice(i, 1);
      else e.metrika = u.metrika;
      return true;
    }
    if (u.metrika < e.metrika) {
      Object.assign(e, { metrika: u.metrika, utak: [ut], utolsoJo: ido });
      return true;
    }
    if (u.metrika === e.metrika && e.utak.length < MAX_UT) {
      e.utak.push(ut);
      e.utolsoJo = ido;
      return true;
    }
    return false;
  }
  function oregit(r, csalad) {
    const a = all(r, csalad);
    const t = idozitok(r, csalad);
    const ido = most(r);
    let valtozott3 = false;
    for (const [k, e] of a.db) {
      if (e.le) {
        const torles = csalad === 4 ? e.utolsoJo + t.torles : e.leKezd + t.torles;
        if (ido >= Math.max(torles, e.leKezd + 1)) a.db.delete(k);
        continue;
      }
      const maradt = e.utak.filter((u) => ido - u.ido < t.ervenytelen);
      if (maradt.length === e.utak.length) continue;
      valtozott3 = true;
      if (maradt.length) e.utak = maradt;
      else leTesz(r, csalad, e);
    }
    return valtozott3;
  }
  function kapcsoltak(r, csalad) {
    const l = [];
    for (const p of r.portok) {
      if (!porton(r, p, csalad) || !portFent(p)) continue;
      if (csalad === 4) {
        const h = prefixHossz(p.maszk);
        l.push({ halozat: halozatSzam(ipSzam(p.ip), h), hossz: h, port: p.nev });
      } else {
        for (const c of p.ipv6) l.push({ halozat: ipv6Halozat(ipv6Elemez(c.cim), c.hossz), hossz: c.hossz, port: p.nev });
      }
    }
    return l;
  }
  function hirdetes(r, csalad, p) {
    const ki = /* @__PURE__ */ new Map();
    const tesz = (halozat, hossz, metrika) => {
      const k = kulcs(csalad, halozat, hossz);
      const regi = ki.get(k);
      if (!regi || metrika < regi.metrika) ki.set(k, { halozat, hossz, metrika });
    };
    const alap = csalad === 4 ? r.rip.alapUtvonal : p.ripngAlap;
    const nulla = csalad === 4 ? 0 : [0, 0, 0, 0, 0, 0, 0, 0];
    if (csalad === 6 && alap === "only") {
      tesz(nulla, 0, 1);
      return ki;
    }
    const kapcs = kapcsoltak(r, csalad);
    const kapcsKulcs = new Set(kapcs.map((c) => kulcs(csalad, c.halozat, c.hossz)));
    for (const c of kapcs) if (c.port !== p.nev) tesz(c.halozat, c.hossz, 1);
    const rib = csalad === 4 ? tabla4(r) : tabla6(r);
    const ribKod = new Map(rib.filter((e) => e.kod !== "L").map((e) => [kulcs(csalad, e.halozat, e.hossz), e.kod]));
    for (const [k, e] of all(r, csalad).db) {
      if (kapcsKulcs.has(k)) continue;
      if (!e.le && ribKod.get(k) !== "R") continue;
      if (e.utak.some((u) => u.port === p.nev)) continue;
      const m = e.le ? VEGTELEN : Math.min(VEGTELEN, e.metrika + (csalad === 4 ? 1 : 0));
      tesz(e.halozat, e.hossz, m);
    }
    if (alap) tesz(nulla, 0, 1);
    if (csalad === 4 && (r.rip.autoSummary || r.rip.verzio !== 2)) {
      const sajat = osztalyos(ipSzam(p.ip));
      const v1 = r.rip.verzio !== 2;
      const osszegzett = /* @__PURE__ */ new Map();
      for (const [k, e] of ki) {
        if (e.hossz === 0) {
          osszegzett.set(k, e);
          continue;
        }
        const o = osztalyos(e.halozat);
        if (o.halozat !== sajat.halozat) {
          if (e.hossz < o.hossz) continue;
          const ok = kulcs(4, o.halozat, o.hossz);
          const regi = osszegzett.get(ok);
          if (!regi || e.metrika < regi.metrika) osszegzett.set(ok, { halozat: o.halozat, hossz: o.hossz, metrika: e.metrika });
        } else if (!v1 || e.hossz === prefixHossz(p.maszk) || e.hossz === 32) {
          osszegzett.set(k, e);
        }
      }
      return osszegzett;
    }
    return ki;
  }
  function kuldVerzio(r) {
    return r.rip && r.rip.verzio === 2 ? 2 : 1;
  }
  function csomagKuld4(r, p, bejegyzesek, parancs = "valasz") {
    const h = r.halozat;
    const v = kuldVerzio(r);
    const celIp = v === 2 ? "224.0.0.9" : "255.255.255.255";
    const celMac = v === 2 ? "01005e000009" : SZORAS;
    const lista3 = bejegyzesek.map((e) => ({
      halozat: ipSzoveg(e.halozat),
      maszk: v === 2 ? maszkSzoveg(e.hossz) : null,
      kovetkezo: "0.0.0.0",
      metrika: e.metrika
    }));
    if (r.debug.rip) {
      if (parancs === "keres") naplo(r, `RIP: sending request on ${p.nev} to ${celIp}`);
      else {
        naplo(r, `RIP: sending v${v} update to ${celIp} via ${p.nev} (${p.ip})`, "RIP: build update entries");
        for (const e of lista3) {
          naplo(r, v === 2 ? `      ${e.halozat}/${prefixHossz(e.maszk)} via 0.0.0.0, metric ${e.metrika}, tag 0` : `      network ${e.halozat} metric ${e.metrika}`);
        }
      }
    }
    const darabok = parancs === "keres" ? [[]] : [];
    for (let i = 0; i < lista3.length; i += UZENET_MERET) darabok.push(lista3.slice(i, i + UZENET_MERET));
    for (const d of darabok) {
      keretKuld(h, r, p, celMac, "ipv4", {
        forrasIp: p.ip,
        celIp,
        ttl: 2,
        protokoll: "udp",
        keses: 0,
        udp: { port: 520, adat: { parancs, verzio: v, bejegyzesek: d } }
      });
    }
  }
  function csomagKuld6(r, p, bejegyzesek, parancs = "valasz") {
    const h = r.halozat;
    const forras = ipv6Szoveg(portLinkLocal(p));
    const lista3 = bejegyzesek.map((e) => ({ prefix: ipv6Szoveg(e.halozat), hossz: e.hossz, metrika: e.metrika }));
    if (r.debug.ripng) {
      if (parancs === "keres") {
        naplo(r, `RIPng: Sending multicast request on ${p.nev} for ${p.ripng}`, `       src=${forras}`, `       dst=FF02::9 (${p.nev})`);
      } else {
        naplo(
          r,
          `RIPng: Sending multicast update on ${p.nev} for ${p.ripng}`,
          `       src=${forras}`,
          `       dst=FF02::9 (${p.nev})`,
          `       sport=521, dport=521, length=${4 + 20 * lista3.length}`,
          `       command=2, version=1, mbz=0, #rte=${lista3.length}`
        );
        for (const e of lista3) naplo(r, `       tag=0, metric=${e.metrika}, prefix=${e.prefix}/${e.hossz}`);
      }
    }
    const darabok = parancs === "keres" ? [[]] : [];
    for (let i = 0; i < lista3.length; i += UZENET_MERET) darabok.push(lista3.slice(i, i + UZENET_MERET));
    for (const d of darabok) {
      keretKuld(h, r, p, "333300000009", "ipv6", {
        forras,
        cel: ipv6Szoveg(RIPNG_CSOPORT),
        hop: 255,
        protokoll: "udp",
        keses: 0,
        udp: { port: 521, adat: { parancs, folyamat: p.ripng, bejegyzesek: d } }
      });
    }
  }
  function csomagKuld(r, p, csalad, bejegyzesek, parancs) {
    if (csalad === 4) csomagKuld4(r, p, bejegyzesek, parancs);
    else csomagKuld6(r, p, bejegyzesek, parancs);
  }
  function frissitesKuld(r, csalad, p, teljes) {
    const a = all(r, csalad);
    const uj = hirdetes(r, csalad, p);
    const regi = a.hirdetett.get(p.nev) || /* @__PURE__ */ new Map();
    const kimegy = [];
    for (const [k, e] of uj) if (teljes || regi.get(k) !== e.metrika) kimegy.push(e);
    for (const [k, m] of regi) {
      if (uj.has(k) || m >= VEGTELEN) continue;
      const [h, l] = k.split("/");
      kimegy.push({ halozat: csalad === 4 ? ipSzam(h) : ipv6Elemez(h), hossz: Number(l), metrika: VEGTELEN });
    }
    const tarol = /* @__PURE__ */ new Map();
    for (const [k, e] of uj) if (e.metrika < VEGTELEN) tarol.set(k, e.metrika);
    a.hirdetett.set(p.nev, tarol);
    if (kimegy.length) csomagKuld(r, p, csalad, kimegy, "valasz");
  }
  function periodikus(r, csalad) {
    const a = all(r, csalad);
    a.periodikus++;
    for (const p of r.portok) if (kuldhet(r, p, csalad)) frissitesKuld(r, csalad, p, true);
  }
  function villamUtemez(r, csalad) {
    const a = all(r, csalad);
    if (!r.halozat || a.villam) return;
    a.villam = r.halozat.ora.utemez(VILLAM_KESES, () => {
      a.villam = null;
      if (!aktiv(r, csalad)) return;
      a.valtozasra++;
      for (const p of r.portok) if (kuldhet(r, p, csalad)) frissitesKuld(r, csalad, p, false);
    });
  }
  function keresKuld(r, csalad, csakPort) {
    for (const p of r.portok) {
      if (csakPort && p !== csakPort) continue;
      if (kuldhet(r, p, csalad)) csomagKuld(r, p, csalad, [], "keres");
    }
  }
  function ripFogad4(h, r, p, cs) {
    if (!ripPorton4(r, p)) return;
    const u = cs.udp.adat;
    if (!portHalozataban(p, cs.forrasIp)) {
      if (r.debug.rip) naplo(r, `RIP: ignored v${u.verzio} update from bad source ${cs.forrasIp} on ${p.nev}`);
      return;
    }
    const fogad = r.rip.verzio === 2 ? [2] : r.rip.verzio === 1 ? [1] : [1, 2];
    if (!fogad.includes(u.verzio)) {
      if (r.debug.rip) naplo(r, `RIP: ignored v${u.verzio} packet from ${cs.forrasIp} (illegal version)`);
      return;
    }
    if (u.parancs === "keres") {
      if (r.debug.rip) naplo(r, `RIP: received v${u.verzio} request from ${cs.forrasIp} on ${p.nev}`);
      if (kuldhet(r, p, 4)) frissitesKuld(r, 4, p, true);
      return;
    }
    const a = all(r, 4);
    a.forrasok.set(cs.forrasIp, most(r));
    if (r.debug.rip) {
      naplo(r, `RIP: received v${u.verzio} update from ${cs.forrasIp} on ${p.nev}`);
      for (const e of u.bejegyzesek) {
        naplo(r, e.maszk ? `     ${e.halozat}/${prefixHossz(e.maszk)} via ${e.kovetkezo} in ${e.metrika} hops` : `     ${e.halozat} in ${e.metrika} hops`);
      }
    }
    let valtozott3 = false;
    const sajat = osztalyos(ipSzam(p.ip));
    for (const e of u.bejegyzesek) {
      if (e.metrika < 1 || e.metrika > VEGTELEN) continue;
      const n = ipSzam(e.halozat);
      let hossz;
      if (e.maszk) hossz = prefixHossz(e.maszk);
      else if (n === 0) hossz = 0;
      else if (osztalyos(n).halozat === sajat.halozat) hossz = halozatSzam(n, prefixHossz(p.maszk)) === n ? prefixHossz(p.maszk) : 32;
      else hossz = osztalyos(n).hossz;
      if (frissit(r, 4, halozatSzam(n, hossz), hossz, { kovetkezo: ipSzam(cs.forrasIp), port: p.nev, metrika: e.metrika })) valtozott3 = true;
    }
    if (valtozott3) {
      valtozas(r);
      villamUtemez(r, 4);
    }
  }
  function ripFogad6(h, r, p, cs) {
    if (!ripPorton6(r, p)) return;
    const u = cs.udp.adat;
    if (!linkLocalE(ipv6Elemez(cs.forras))) return;
    if (u.parancs === "keres") {
      if (r.debug.ripng) naplo(r, `RIPng: request received from ${cs.forras} on ${p.nev} for ${p.ripng}`);
      if (kuldhet(r, p, 6)) frissitesKuld(r, 6, p, true);
      return;
    }
    const a = all(r, 6);
    a.forrasok.set(cs.forras, most(r));
    if (r.debug.ripng) {
      naplo(
        r,
        `RIPng: response received from ${cs.forras} on ${p.nev} for ${p.ripng}`,
        `       src=${cs.forras} (${p.nev})`,
        "       dst=FF02::9",
        `       sport=521, dport=521, length=${4 + 20 * u.bejegyzesek.length}`,
        `       command=2, version=1, mbz=0, #rte=${u.bejegyzesek.length}`
      );
      for (const e of u.bejegyzesek) naplo(r, `       tag=0, metric=${e.metrika}, prefix=${e.prefix}/${e.hossz}`);
    }
    let valtozott3 = false;
    for (const e of u.bejegyzesek) {
      if (e.metrika < 1 || e.metrika > VEGTELEN) continue;
      const m = Math.min(VEGTELEN, e.metrika + 1);
      const hal = ipv6Halozat(ipv6Elemez(e.prefix), e.hossz);
      if (frissit(r, 6, hal, e.hossz, { kovetkezo: ipv6Elemez(cs.forras), port: p.nev, metrika: m })) valtozott3 = true;
    }
    if (valtozott3) {
      valtozas(r);
      villamUtemez(r, 6);
    }
  }
  function valtozas(r) {
    if (r.halozat) r.halozat.esemeny({ tipus: "allapot" });
  }
  function ripValtozott(r, { keres = false, csalad } = {}) {
    if (!r.halozat) return;
    for (const c of csalad ? [csalad] : [4, 6]) {
      if (!aktiv(r, c)) {
        all(r, c).db.clear();
        all(r, c).hirdetett.clear();
        continue;
      }
      const a = all(r, c);
      for (const [k, e] of a.db) {
        e.utak = e.utak.filter((u) => {
          const p = r.portok.find((x) => x.nev === u.port);
          return p && porton(r, p, c);
        });
        if (!e.utak.length) a.db.delete(k);
      }
      for (const nev of [...a.hirdetett.keys()]) {
        const p = r.portok.find((x) => x.nev === nev);
        if (!p || !kuldhet(r, p, c)) a.hirdetett.delete(nev);
      }
      if (keres) keresKuld(r, c);
      villamUtemez(r, c);
    }
    valtozas(r);
  }
  function ripPortValtozott(h, r, p) {
    for (const c of [4, 6]) {
      if (!aktiv(r, c)) continue;
      const a = all(r, c);
      if (!portFent(p)) {
        for (const [k, e] of a.db) {
          e.utak = e.utak.filter((u) => u.port !== p.nev);
          if (!e.utak.length) a.db.delete(k);
        }
        a.hirdetett.delete(p.nev);
      } else {
        keresKuld(r, c, p);
      }
      villamUtemez(r, c);
    }
  }
  function ripTorol(r) {
    if (!aktiv(r, 4)) return;
    const a = all(r, 4);
    a.db.clear();
    a.hirdetett.clear();
    keresKuld(r, 4);
    valtozas(r);
  }
  function ripIndit(h) {
    const routerek = h.eszkozok.filter((e) => e.tipus === "router");
    if (!routerek.length) return;
    const lep = () => {
      routerek.forEach((r, i) => {
        for (const c of [4, 6]) {
          const a = all(r, c);
          if (!aktiv(r, c)) {
            a.kovetkezo = null;
            continue;
          }
          if (oregit(r, c)) {
            valtozas(r);
            villamUtemez(r, c);
          }
          const t = idozitok(r, c);
          if (a.kovetkezo === null) a.kovetkezo = h.ora.ido + 5e3 + (i * 7e3 + (c === 6 ? 3e3 : 0)) % t.frissites;
          if (h.ora.ido >= a.kovetkezo) {
            a.kovetkezo = h.ora.ido + t.frissites;
            periodikus(r, c);
          }
        }
      });
      h.ora.utemez(1e3, lep);
    };
    h.ora.utemez(1e3, lep);
  }
  function ripUtvonalak(r, csalad) {
    if (!aktiv(r, csalad)) return [];
    return [...all(r, csalad).db.values()].map((e) => ({ ...e, utak: e.utak.map((u) => ({ ...u })) }));
  }
  function ripAdatbazis(r, csalad) {
    if (!aktiv(r, csalad)) return { kapcsolt: [], tanult: [] };
    return {
      kapcsolt: kapcsoltak(r, csalad),
      tanult: ripUtvonalak(r, csalad)
    };
  }
  function ripForrasok(r, csalad) {
    return [...all(r, csalad).forrasok.entries()].map(([cim, ido]) => ({ cim, ido }));
  }
  function ripKovetkezo(r, csalad) {
    const a = all(r, csalad);
    if (a.kovetkezo === null) return null;
    return Math.max(0, Math.ceil((a.kovetkezo - most(r)) / 1e3));
  }
  function ripSzamlalok(r, csalad) {
    const a = all(r, csalad);
    return { periodikus: a.periodikus, valtozasra: a.valtozasra };
  }

  // src/mag/ospf.js
  var ELSO_SORSZAM = 2147483649;
  var RXMT = 5e3;
  var SPF_KESES = 50;
  var CSOPORT = {
    4: { minden: "224.0.0.5", dr: "224.0.0.6", mindenMac: "01005e000005", drMac: "01005e000006" },
    6: { minden: "FF02::5", dr: "FF02::6", mindenMac: "333300000005", drMac: "333300000006" }
  };
  var ALLAPOTOK = ["DOWN", "INIT", "2WAY", "EXSTART", "EXCHANGE", "LOADING", "FULL"];
  var SZINT = Object.fromEntries(ALLAPOTOK.map((a, i) => [a, i]));
  function ospfBeall(r, csalad) {
    return csalad === 4 ? r.ospf : r.ospf6;
  }
  function portBeall(p, csalad) {
    return csalad === 4 ? p.ospf : p.ospf6;
  }
  function savszelesseg(p) {
    if (p.savszel) return p.savszel;
    if (p.tipus === "Serial") return 1544;
    if (p.tipus === "Loopback") return 8e6;
    return 1e6;
  }
  function koltseg(r, p, csalad) {
    const pb = portBeall(p, csalad);
    if (pb.koltseg) return pb.koltseg;
    const o = ospfBeall(r, csalad);
    const ref = o ? o.referencia : 100;
    return Math.max(1, Math.min(65535, Math.floor(ref * 1e3 / savszelesseg(p))));
  }
  function halozatTipus(p, csalad) {
    if (p.tipus === "Loopback") return "LOOPBACK";
    const t = portBeall(p, csalad).halozatTipus;
    if (t === "point-to-point") return "POINT_TO_POINT";
    if (t === "broadcast") return "BROADCAST";
    return p.tipus === "Serial" ? "POINT_TO_POINT" : "BROADCAST";
  }
  function idokozok(p, csalad) {
    const pb = portBeall(p, csalad);
    const hello = pb.hello || 10;
    const dead = pb.dead || hello * 4;
    return { hello, dead };
  }
  function mtu(p, csalad) {
    return (csalad === 4 ? p.mtu : p.mtu6) || 1500;
  }
  function interfeszAzon(r, p) {
    if (p.tipus === "Loopback") return 20 + Number(p.szam);
    return r.portok.filter((x) => x.tipus !== "Loopback").indexOf(p) + 1;
  }
  function popcount(n) {
    let c = 0;
    for (let x = n >>> 0; x; x >>>= 1) c += x & 1;
    return c;
  }
  function ospfTerulet(r, p, csalad) {
    const o = ospfBeall(r, csalad);
    if (!o) return null;
    const pb = portBeall(p, csalad);
    if (csalad === 6) {
      if (!r.ipv6Routing || !ipv6Engedelyezve(p)) return null;
      if (pb.folyamat === o.folyamat && pb.terulet !== null) return { terulet: pb.terulet, mod: "interfesz" };
      return null;
    }
    if (!p.ip) return null;
    if (pb.folyamat !== null) return pb.folyamat === o.folyamat ? { terulet: pb.terulet, mod: "interfesz" } : null;
    const ip = ipSzam(p.ip);
    let jo = null;
    for (const n of o.halozatok) {
      const wc = ipSzam(n.wildcard);
      if ((ip & ~wc) >>> 0 !== (ipSzam(n.cim) & ~wc) >>> 0) continue;
      if (!jo || popcount(wc) < popcount(ipSzam(jo.wildcard))) jo = n;
    }
    return jo ? { terulet: jo.terulet, mod: "network" } : null;
  }
  function passzivE(r, p, csalad) {
    const o = ospfBeall(r, csalad);
    if (!o) return false;
    if (o.passzivAlap) return !o.nemPassziv.includes(p.nev);
    return o.passziv.includes(p.nev);
  }
  var belso3 = /* @__PURE__ */ new WeakMap();
  function ujAllapot() {
    return {
      fut: false,
      rid: null,
      // router ID (szövegesen)
      indulas: 0,
      nortrid: false,
      // a „nem tudok router ID-t választani” üzenet már kiment
      /** port neve → interfész-állapot */
      ifek: /* @__PURE__ */ new Map(),
      /** terület → Map(kulcs → LSA); a 'K' kulcs alatt a külső (AS External) LSA-k */
      lsdb: /* @__PURE__ */ new Map(),
      /** saját LSA-k legutóbbi sorszámai (a folyamat újraindítása után is innen folytatja) */
      sorszamok: /* @__PURE__ */ new Map(),
      utvonalak: [],
      utvonalIdo: /* @__PURE__ */ new Map(),
      spf: null,
      spfSzam: 0,
      spfIdo: null,
      forrasok: /* @__PURE__ */ new Map(),
      // rid → az utolsó változás ideje (show ip protocols)
      dupNaplo: /* @__PURE__ */ new Map()
    };
  }
  function all2(r, csalad) {
    let a = belso3.get(r);
    if (!a) belso3.set(r, a = { 4: ujAllapot(), 6: ujAllapot() });
    return a[csalad];
  }
  function most2(r) {
    return r.halozat ? r.halozat.ora.ido : 0;
  }
  function naplo2(r, ...sorok) {
    if (!r.halozat) return;
    for (const s of sorok) r.halozat.naplo(r, s);
  }
  function valtozas2(r) {
    if (r.halozat) r.halozat.esemeny({ tipus: "allapot" });
  }
  function rovid(nev) {
    return nev.replace(/^GigabitEthernet/, "Gi").replace(/^Serial/, "Se").replace(/^Loopback/, "Lo");
  }
  function dbgElo(r, csalad, fajta, p) {
    const o = ospfBeall(r, csalad);
    const fej = csalad === 4 ? `OSPF-${o ? o.folyamat : 1}` : `OSPFv3-${o ? o.folyamat : 1}-IPv6`;
    return `${fej} ${fajta.padEnd(5)} ${rovid(p.nev)}: `;
  }
  function dbgHello(r, csalad, p, szoveg) {
    if (csalad === 4 ? r.debug.ospfHello : r.debug.ospf6Hello) naplo2(r, dbgElo(r, csalad, "HELLO", p) + szoveg);
  }
  function dbgAdj(r, csalad, p, szoveg) {
    if (csalad === 4 ? r.debug.ospfAdj : r.debug.ospf6Adj) naplo2(r, dbgElo(r, csalad, "ADJ", p) + szoveg);
  }
  function adjNaplo(r, csalad, p, nbr, regi, uj, ok) {
    const o = ospfBeall(r, csalad);
    const fej = csalad === 4 ? `%OSPF-5-ADJCHG: Process ${o.folyamat}` : `%OSPFv3-5-ADJCHG: Process ${o.folyamat}`;
    naplo2(r, `${fej}, Nbr ${nbr.rid} on ${p.nev} from ${regi} to ${uj}, ${ok}`);
  }
  function sajatCim(p, csalad) {
    return csalad === 4 ? p.ip : ipv6Szoveg(portLinkLocal(p));
  }
  function autoRouterId(r) {
    const valaszt = (lista3) => lista3.reduce((m, p) => m === null || ipSzam(p.ip) > ipSzam(m) ? p.ip : m, null);
    const lo = r.portok.filter((p) => p.tipus === "Loopback" && p.ip && portFent(p));
    if (lo.length) return valaszt(lo);
    const tobbi = r.portok.filter((p) => p.ip && portFent(p));
    return tobbi.length ? valaszt(tobbi) : null;
  }
  function kuld2(r, p, csalad, ospf, cel) {
    const h = r.halozat;
    if (!h) return;
    const cs = CSOPORT[csalad];
    let celCim;
    let mac;
    if (cel === "minden") {
      celCim = cs.minden;
      mac = cs.mindenMac;
    } else if (cel === "dr") {
      celCim = cs.dr;
      mac = cs.drMac;
    } else {
      celCim = cel.cim;
      mac = cel.mac;
    }
    const a = all2(r, csalad);
    const adat = { ...ospf, rid: a.rid, terulet: a.ifek.get(p.nev).terulet, hit: hitelesites(p, csalad) };
    if (csalad === 4) {
      keretKuld(h, r, p, mac, "ipv4", { forrasIp: p.ip, celIp: celCim, ttl: 1, protokoll: "ospf", keses: 0, ospf: adat });
    } else {
      keretKuld(h, r, p, mac, "ipv6", { forras: sajatCim(p, 6), cel: celCim, hop: 1, protokoll: "ospf", keses: 0, ospf: adat });
    }
  }
  function hitelesites(p, csalad) {
    if (csalad === 6) return { tipus: 0 };
    const pb = p.ospf;
    if (pb.hitelesites === "md5") {
      const ids = Object.keys(pb.kulcsok).map(Number).sort((a, b) => b - a);
      return ids.length ? { tipus: 2, kulcsId: ids[0], jelszo: pb.kulcsok[ids[0]] } : { tipus: 2, kulcsId: null };
    }
    if (pb.hitelesites === "egyszeru") return { tipus: 1, jelszo: pb.jelszo };
    return { tipus: 0 };
  }
  function helloKuld(r, csalad, p, I) {
    const { hello, dead } = idokozok(p, csalad);
    const nbrek = [...I.szomszedok.values()].map((n) => n.rid);
    const dek = (x) => x ? csalad === 4 ? x.cim : x.rid : "0.0.0.0";
    const h = {
      tipus: "hello",
      hello,
      dead,
      prioritas: portBeall(p, csalad).prioritas,
      maszk: csalad === 4 ? p.maszk : void 0,
      dr: I.tipus === "BROADCAST" ? dek(I.dr) : "0.0.0.0",
      bdr: I.tipus === "BROADCAST" ? dek(I.bdr) : "0.0.0.0",
      szomszedok: nbrek,
      ifId: interfeszAzon(r, p)
    };
    dbgHello(r, csalad, p, `Send hello to ${CSOPORT[csalad].minden} area ${I.terulet} from ${sajatCim(p, csalad)}`);
    kuld2(r, p, csalad, h, "minden");
  }
  function ifIndit(r, csalad, p, terulet) {
    const a = all2(r, csalad);
    const tipus = halozatTipus(p, csalad);
    const I = {
      port: p.nev,
      terulet,
      tipus,
      allapot: "DOWN",
      dr: null,
      bdr: null,
      szomszedok: /* @__PURE__ */ new Map(),
      kovHello: most2(r),
      waitVege: null,
      passziv: passzivE(r, p, csalad),
      idok: idokozok(p, csalad),
      mtu: mtu(p, csalad)
    };
    a.ifek.set(p.nev, I);
    if (tipus === "LOOPBACK") I.allapot = "LOOPBACK";
    else if (tipus === "POINT_TO_POINT") I.allapot = "P2P";
    else if (I.passziv) {
      valasztas(r, csalad, p, I);
    } else {
      I.allapot = "WAITING";
      I.waitVege = most2(r) + I.idok.dead * 1e3;
    }
    if (!I.passziv && tipus !== "LOOPBACK") helloKuld(r, csalad, p, I);
    I.kovHello = most2(r) + I.idok.hello * 1e3;
    return I;
  }
  function ifLeall(r, csalad, nev, ok = "Interface down or detached") {
    const a = all2(r, csalad);
    const I = a.ifek.get(nev);
    if (!I) return;
    const p = r.portok.find((x) => x.nev === nev);
    for (const n of [...I.szomszedok.values()]) szomszedLe(r, csalad, p, I, n, ok, false);
    a.ifek.delete(nev);
  }
  function allapotValt(r, csalad, p, I, n, uj, ok) {
    const regi = n.allapot;
    if (regi === uj) return;
    n.allapot = uj;
    if (uj === "FULL") {
      adjNaplo(r, csalad, p, n, regi, uj, ok || "Loading Done");
      all2(r, csalad).forrasok.set(n.rid, most2(r));
    }
    valtozas2(r);
  }
  function szomszedLe(r, csalad, p, I, n, ok, ujravalaszt = true) {
    const regi = n.allapot;
    I.szomszedok.delete(n.rid);
    if (regi !== "INIT" && regi !== "DOWN") adjNaplo(r, csalad, p, n, regi, "DOWN", `Neighbor Down: ${ok}`);
    if (ujravalaszt && I.tipus === "BROADCAST" && I.allapot !== "WAITING") valasztas(r, csalad, p, I);
    if (SZINT[regi] >= SZINT.EXSTART) lsaFrissit(r, csalad);
    valtozas2(r);
  }
  function kellSzomszedsag(I, n) {
    if (I.tipus !== "BROADCAST") return true;
    const en = I.allapot === "DR" || I.allapot === "BDR";
    const o = I.dr && I.dr.rid === n.rid || I.bdr && I.bdr.rid === n.rid;
    return en || o;
  }
  function szomszedsagokIgazit(r, csalad, p, I) {
    for (const n of I.szomszedok.values()) {
      if (SZINT[n.allapot] < SZINT["2WAY"]) continue;
      const kell = kellSzomszedsag(I, n);
      if (kell && n.allapot === "2WAY") exstartIndit(r, csalad, p, I, n);
      else if (!kell && SZINT[n.allapot] > SZINT["2WAY"]) {
        allapotValt(r, csalad, p, I, n, "2WAY");
        n.keresek = /* @__PURE__ */ new Set();
        lsaFrissit(r, csalad);
      }
    }
  }
  function exstartIndit(r, csalad, p, I, n) {
    allapotValt(r, csalad, p, I, n, "EXSTART");
    n.fejlecKapott = false;
    n.keresek = /* @__PURE__ */ new Set();
    dbgAdj(r, csalad, p, `Nbr ${n.rid}: Prepare dbase exchange`);
    dbdKuld(r, csalad, p, I, n, true);
  }
  function nagyobb(a, b) {
    if (a.prioritas !== b.prioritas) return a.prioritas > b.prioritas;
    return ipSzam(a.rid) > ipSzam(b.rid);
  }
  function legjobb(lista3) {
    return lista3.reduce((m, x) => !m || nagyobb(x, m) ? x : m, null);
  }
  function valasztas(r, csalad, p, I) {
    const a = all2(r, csalad);
    const pr = portBeall(p, csalad).prioritas;
    const en = { rid: a.rid, cim: sajatCim(p, csalad), prioritas: pr, en: true };
    const regiAllapot = I.allapot;
    const regiDr = I.dr && I.dr.rid;
    const jeloltek = [];
    for (const n of I.szomszedok.values()) {
      if (SZINT[n.allapot] < SZINT["2WAY"] || n.prioritas === 0) continue;
      jeloltek.push({ rid: n.rid, cim: n.cim, prioritas: n.prioritas, drNek: n.drNek, bdrNek: n.bdrNek });
    }
    let enDr = !!(I.dr && I.dr.rid === a.rid);
    let enBdr = !!(I.bdr && I.bdr.rid === a.rid);
    let dr = null;
    let bdr = null;
    for (let kor2 = 0; kor2 < 3; kor2++) {
      const mind = pr > 0 ? [...jeloltek, { ...en, drNek: enDr, bdrNek: enBdr }] : jeloltek;
      const nemDr = mind.filter((x) => !x.drNek);
      const bdrVallo = nemDr.filter((x) => x.bdrNek);
      bdr = legjobb(bdrVallo.length ? bdrVallo : nemDr);
      const drVallo = mind.filter((x) => x.drNek);
      dr = drVallo.length ? legjobb(drVallo) : bdr;
      if (dr && bdr && dr.rid === bdr.rid) bdr = legjobb(mind.filter((x) => x.rid !== dr.rid));
      const ujDr = !!(dr && dr.rid === a.rid);
      const ujBdr = !!(bdr && bdr.rid === a.rid);
      if (ujDr === enDr && ujBdr === enBdr) break;
      enDr = ujDr;
      enBdr = ujBdr;
    }
    I.dr = dr ? { rid: dr.rid, cim: dr.cim } : null;
    I.bdr = bdr ? { rid: bdr.rid, cim: bdr.cim } : null;
    I.allapot = enDr ? "DR" : enBdr ? "BDR" : "DROTHER";
    I.waitVege = null;
    if (regiAllapot !== I.allapot || regiDr !== (I.dr && I.dr.rid)) {
      dbgAdj(r, csalad, p, "DR/BDR election");
      dbgAdj(r, csalad, p, `Elect BDR ${I.bdr ? I.bdr.rid : "0.0.0.0"}`);
      dbgAdj(r, csalad, p, `Elect DR ${I.dr ? I.dr.rid : "0.0.0.0"}`);
    }
    szomszedsagokIgazit(r, csalad, p, I);
    lsaFrissit(r, csalad);
    valtozas2(r);
  }
  function ospfFogad(h, r, p, cs, csalad, forrasMac) {
    const a = all2(r, csalad);
    if (!a.fut) return;
    const I = a.ifek.get(p.nev);
    const o = cs.ospf;
    if (!I || I.passziv || I.tipus === "LOOPBACK") return;
    const forras = csalad === 4 ? cs.forrasIp : cs.forras;
    if (csalad === 4 && !portHalozataban(p, forras)) return;
    if ((cs.celIp || cs.cel) === CSOPORT[csalad].dr && I.allapot !== "DR" && I.allapot !== "BDR") return;
    if (csalad === 4) {
      const sajat = hitelesites(p, 4);
      const jott = o.hit || { tipus: 0 };
      if (sajat.tipus !== jott.tipus) {
        dbgAdj(r, csalad, p, `Rcv pkt from ${forras} : Mismatched Authentication type. Input packet specified type ${jott.tipus}, we use type ${sajat.tipus}`);
        return;
      }
      if (sajat.tipus === 2) {
        const kulcs2 = p.ospf.kulcsok[jott.kulcsId];
        if (kulcs2 === void 0) {
          dbgAdj(r, csalad, p, `Rcv pkt from ${forras} : Mismatched Authentication Key - No message digest key ${jott.kulcsId} on interface`);
          return;
        }
        if (kulcs2 !== jott.jelszo) {
          dbgAdj(r, csalad, p, `Rcv pkt from ${forras} : Mismatched Authentication Key - Message Digest Key ${jott.kulcsId}`);
          return;
        }
      }
      if (sajat.tipus === 1 && sajat.jelszo !== jott.jelszo) {
        dbgAdj(r, csalad, p, `Rcv pkt from ${forras} : Mismatched Authentication Key - Clear Text`);
        return;
      }
    }
    if (o.terulet !== I.terulet) {
      dbgHello(r, csalad, p, `Rcv pkt from ${forras}, area ${ipSzoveg(o.terulet)}, mismatched area ${ipSzoveg(I.terulet)} in the header`);
      return;
    }
    if (o.tipus === "hello") return helloFogad(r, csalad, p, I, o, forras, forrasMac);
    const n = I.szomszedok.get(o.rid);
    if (!n) return;
    if (o.tipus === "dbd") return dbdFogad(r, csalad, p, I, n, o);
    if (o.tipus === "lsr") return lsrFogad(r, csalad, p, I, n, o);
    if (o.tipus === "lsu") return lsuFogad(r, csalad, p, I, n, o);
    return void 0;
  }
  function helloFogad(r, csalad, p, I, o, forras, forrasMac) {
    const a = all2(r, csalad);
    const { hello, dead } = I.idok;
    const maszkHiba = csalad === 4 && I.tipus === "BROADCAST" && o.maszk !== p.maszk;
    if (o.hello !== hello || o.dead !== dead || maszkHiba) {
      dbgHello(r, csalad, p, `Mismatched hello parameters from ${forras}`);
      dbgHello(r, csalad, p, `Dead R ${o.dead} C ${dead}, Hello R ${o.hello} C ${hello}` + (csalad === 4 ? ` Mask R ${o.maszk} C ${p.maszk}` : ""));
      return;
    }
    if (o.rid === a.rid) {
      const utolso = a.dupNaplo.get(p.nev);
      if (utolso === void 0 || most2(r) - utolso >= 6e4) {
        a.dupNaplo.set(p.nev, most2(r));
        naplo2(r, csalad === 4 ? `%OSPF-4-DUP_RTRID_NBR: OSPF detected duplicate router-id ${o.rid} from ${forras} on interface ${p.nev}` : `%OSPFv3-4-DUP_RTRID_NBR: OSPFv3 detected duplicate router-id ${o.rid} from ${forras} on interface ${p.nev}`);
      }
      return;
    }
    dbgHello(r, csalad, p, `Rcv hello from ${o.rid} area ${I.terulet} ${forras}`);
    let n = I.szomszedok.get(o.rid);
    const uj = !n;
    if (!n) {
      n = { rid: o.rid, allapot: "DOWN", keresek: /* @__PURE__ */ new Set(), fejlecKapott: false, rxmtKov: null };
      I.szomszedok.set(o.rid, n);
    }
    const regiPr = n.prioritas;
    const regiDr = n.drNek;
    const regiBdr = n.bdrNek;
    n.cim = forras;
    n.mac = forrasMac;
    n.prioritas = o.prioritas;
    n.ifId = o.ifId;
    n.deadLejar = most2(r) + dead * 1e3;
    n.drVallott = o.dr;
    n.bdrVallott = o.bdr;
    const sajatAzon = csalad === 4 ? forras : o.rid;
    n.drNek = o.dr === sajatAzon;
    n.bdrNek = o.bdr === sajatAzon;
    if (n.allapot === "DOWN") allapotValt(r, csalad, p, I, n, "INIT");
    if (uj) valtozas2(r);
    const latnak = o.szomszedok.includes(a.rid);
    if (latnak && n.allapot === "INIT") {
      allapotValt(r, csalad, p, I, n, "2WAY");
      dbgAdj(r, csalad, p, `2 Way Communication to ${n.rid}, state 2WAY`);
      if (I.tipus === "BROADCAST") {
        if (I.allapot !== "WAITING") valasztas(r, csalad, p, I);
        else if (n.bdrNek || n.drNek && o.bdr === "0.0.0.0") valasztas(r, csalad, p, I);
      }
      if (n.allapot === "2WAY" && kellSzomszedsag(I, n)) exstartIndit(r, csalad, p, I, n);
      return;
    }
    if (!latnak && SZINT[n.allapot] >= SZINT["2WAY"]) {
      const regi = n.allapot;
      n.allapot = "INIT";
      n.keresek = /* @__PURE__ */ new Set();
      dbgAdj(r, csalad, p, `Nbr ${n.rid}: 1-Way Hello received, state INIT`);
      if (I.tipus === "BROADCAST" && I.allapot !== "WAITING") valasztas(r, csalad, p, I);
      if (SZINT[regi] >= SZINT.EXSTART) lsaFrissit(r, csalad);
      valtozas2(r);
      return;
    }
    if (I.tipus === "BROADCAST" && SZINT[n.allapot] >= SZINT["2WAY"]) {
      if (I.allapot === "WAITING") {
        if (n.bdrNek || n.drNek && o.bdr === "0.0.0.0") valasztas(r, csalad, p, I);
      } else if (regiPr !== n.prioritas || regiDr !== n.drNek || regiBdr !== n.bdrNek) {
        valasztas(r, csalad, p, I);
      }
    }
  }
  function fejlecek(r, csalad, terulet, portNev) {
    const db = lsdb(r, csalad, terulet);
    const kulso = lsdb(r, csalad, "K");
    return [...db.values(), ...kulso.values()].filter((l) => !l.maxAge && (l.hatokor !== "link" || l.link === portNev)).map((l) => ({ kulcs: l.kulcs, sorszam: l.sorszam }));
  }
  function dbdKuld(r, csalad, p, I, n, init) {
    const dbd = { tipus: "dbd", init, mtu: I.mtu, fejlecek: init ? [] : fejlecek(r, csalad, I.terulet, p.nev), kerValaszt: !n.fejlecKapott };
    dbgAdj(r, csalad, p, `Send DBD to ${n.rid} ${init ? "flag 0x7" : "flag 0x0"} len ${32 + dbd.fejlecek.length * 20}`);
    kuld2(r, p, csalad, dbd, { cim: n.cim, mac: n.mac });
    n.rxmtKov = most2(r) + RXMT;
  }
  function dbdFogad(r, csalad, p, I, n, d) {
    if (SZINT[n.allapot] < SZINT.EXSTART) return;
    dbgAdj(r, csalad, p, `Rcv DBD from ${n.rid} ${d.init ? "flag 0x7" : "flag 0x0"} len ${32 + d.fejlecek.length * 20}  mtu ${d.mtu} state ${n.allapot}`);
    if (d.mtu > I.mtu) {
      dbgAdj(r, csalad, p, `Nbr ${n.rid} has larger interface MTU`);
      return;
    }
    if (n.allapot === "EXSTART") {
      const a = all2(r, csalad);
      dbgAdj(r, csalad, p, `NBR Negotiation Done. We are the ${ipSzam(a.rid) > ipSzam(n.rid) ? "MASTER" : "SLAVE"}`);
      allapotValt(r, csalad, p, I, n, "EXCHANGE");
      dbdKuld(r, csalad, p, I, n, false);
      if (d.init) return;
    }
    if (d.init) {
      if (n.allapot !== "EXSTART") dbdKuld(r, csalad, p, I, n, false);
      return;
    }
    if (d.kerValaszt && n.fejlecKapott) dbdKuld(r, csalad, p, I, n, false);
    if (n.fejlecKapott) return;
    n.fejlecKapott = true;
    for (const f of d.fejlecek) {
      const sajat = lsaKeres(r, csalad, I.terulet, f.kulcs);
      if (!sajat || sajat.sorszam < f.sorszam) n.keresek.add(f.kulcs);
    }
    if (n.allapot === "EXCHANGE") {
      dbgAdj(r, csalad, p, `Exchange Done with ${n.rid}`);
      if (n.keresek.size) {
        allapotValt(r, csalad, p, I, n, "LOADING");
        lsrKuld(r, csalad, p, n);
      } else {
        allapotValt(r, csalad, p, I, n, "FULL", "Exchange Done");
        dbgAdj(r, csalad, p, `Synchronized with ${n.rid}, state FULL`);
        n.rxmtKov = null;
        lsaFrissit(r, csalad);
      }
    }
  }
  function lsrKuld(r, csalad, p, n) {
    kuld2(r, p, csalad, { tipus: "lsr", kulcsok: [...n.keresek] }, { cim: n.cim, mac: n.mac });
    n.rxmtKov = most2(r) + RXMT;
  }
  function lsrFogad(r, csalad, p, I, n, k) {
    if (SZINT[n.allapot] < SZINT.EXCHANGE) return;
    const lsak = k.kulcsok.map((x) => lsaKeres(r, csalad, I.terulet, x)).filter(Boolean);
    if (lsak.length) kuld2(r, p, csalad, { tipus: "lsu", lsak: lsak.map(masol) }, { cim: n.cim, mac: n.mac });
  }
  function masol(l) {
    return JSON.parse(JSON.stringify(l));
  }
  function lsuFogad(r, csalad, p, I, n, u) {
    if (SZINT[n.allapot] < SZINT.EXCHANGE) return;
    const a = all2(r, csalad);
    const ujak = [];
    let sajatVissza = false;
    for (const l of u.lsak) {
      const terulet = l.tipus === "kulso" ? "K" : I.terulet;
      const db = lsdb(r, csalad, terulet);
      const regi = db.get(l.kulcs);
      n.keresek.delete(l.kulcs);
      if (regi && regi.sorszam >= l.sorszam) continue;
      if (l.adv === a.rid) {
        a.sorszamok.set(l.kulcs, Math.max(a.sorszamok.get(l.kulcs) || 0, l.sorszam));
        if (!regi) db.set(l.kulcs, { ...l, link: l.hatokor === "link" ? p.nev : void 0 });
        sajatVissza = true;
        continue;
      }
      if (l.maxAge) db.delete(l.kulcs);
      else db.set(l.kulcs, { ...l, link: l.hatokor === "link" ? p.nev : void 0 });
      if (l.hatokor !== "link") ujak.push(l);
    }
    kuld2(r, p, csalad, { tipus: "ack", db: u.lsak.length }, { cim: n.cim, mac: n.mac });
    if (sajatVissza) lsaFrissit(r, csalad);
    if (ujak.length) {
      elaraszt(r, csalad, ujak, { port: p.nev, rid: n.rid });
      spfUtemez(r, csalad);
    }
    if (n.allapot === "LOADING" && n.keresek.size === 0) {
      allapotValt(r, csalad, p, I, n, "FULL", "Loading Done");
      dbgAdj(r, csalad, p, `Synchronized with ${n.rid}, state FULL`);
      n.rxmtKov = null;
      lsaFrissit(r, csalad);
    }
  }
  function elaraszt(r, csalad, lsak, honnan = null) {
    const a = all2(r, csalad);
    for (const [nev, I] of a.ifek) {
      if (I.passziv || I.tipus === "LOOPBACK") continue;
      const teljes = [...I.szomszedok.values()].filter((n) => SZINT[n.allapot] >= SZINT.EXCHANGE);
      if (!teljes.length) continue;
      if (honnan && honnan.port === nev) {
        if (I.tipus !== "BROADCAST" || I.allapot !== "DR") continue;
        if (teljes.every((n) => n.rid === honnan.rid)) continue;
      }
      const p = r.portok.find((x) => x.nev === nev);
      const kimegy = lsak.filter((l) => (l.terulet === I.terulet || l.tipus === "kulso") && (l.hatokor !== "link" || l.link === nev));
      if (!kimegy.length) continue;
      const cel = I.tipus === "BROADCAST" && I.allapot === "DROTHER" ? "dr" : "minden";
      kuld2(r, p, csalad, { tipus: "lsu", lsak: kimegy.map(masol) }, cel);
    }
  }
  function lsdb(r, csalad, terulet) {
    const a = all2(r, csalad);
    if (!a.lsdb.has(terulet)) a.lsdb.set(terulet, /* @__PURE__ */ new Map());
    return a.lsdb.get(terulet);
  }
  function lsaKeres(r, csalad, terulet, kulcs2) {
    const l = lsdb(r, csalad, terulet).get(kulcs2) || lsdb(r, csalad, "K").get(kulcs2);
    return l && !l.maxAge ? l : null;
  }
  function teljesSzomszedok(I) {
    return [...I.szomszedok.values()].filter((n) => n.allapot === "FULL");
  }
  function tranzitE(r, csalad, I) {
    if (I.tipus !== "BROADCAST" || !I.dr) return false;
    const a = all2(r, csalad);
    if (I.dr.rid === a.rid) return teljesSzomszedok(I).length > 0;
    const n = I.szomszedok.get(I.dr.rid);
    return !!n && n.allapot === "FULL";
  }
  function elotagok6(p, I, k) {
    if (I.tipus === "LOOPBACK") {
      return p.ipv6.map((c) => ({ prefix: `${ipv6Szoveg(ipv6Elemez(c.cim))}/128`, metrika: 0 }));
    }
    return p.ipv6.map((c) => ({ prefix: `${ipv6Szoveg(ipv6Halozat(ipv6Elemez(c.cim), c.hossz))}/${c.hossz}`, metrika: k }));
  }
  function kivantLsak(r, csalad) {
    const a = all2(r, csalad);
    const o = ospfBeall(r, csalad);
    const ki = /* @__PURE__ */ new Map();
    const tesz = (l) => {
      l.kulcs = `${l.tipus}|${l.lsId}|${a.rid}${l.link ? "|" + l.link : ""}`;
      ki.set(l.kulcs, l);
    };
    const vanAlap = alapNemOspf(r, csalad);
    const kulsoAlap = o.alapUtvonal === "always" || o.alapUtvonal === "originate" && vanAlap;
    const teruletek = new Set([...a.ifek.values()].map((I) => I.terulet));
    for (const T of teruletek) {
      const linkek = [];
      const prefixek = [];
      for (const [nev, I] of a.ifek) {
        if (I.terulet !== T) continue;
        const p = r.portok.find((x) => x.nev === nev);
        const k = koltseg(r, p, csalad);
        if (csalad === 4) {
          const hossz = prefixHossz(p.maszk);
          const halo = ipSzoveg(halozatSzam(ipSzam(p.ip), hossz));
          if (I.tipus === "LOOPBACK") {
            linkek.push({ tipus: "stub", id: p.ip, adat: "255.255.255.255", koltseg: 1 });
          } else if (I.tipus === "POINT_TO_POINT") {
            for (const n of teljesSzomszedok(I)) linkek.push({ tipus: "p2p", id: n.rid, adat: p.ip, koltseg: k });
            linkek.push({ tipus: "stub", id: halo, adat: p.maszk, koltseg: k });
          } else if (tranzitE(r, csalad, I)) {
            linkek.push({ tipus: "transit", id: I.dr.cim, adat: p.ip, koltseg: k });
          } else {
            linkek.push({ tipus: "stub", id: halo, adat: p.maszk, koltseg: k });
          }
          if (I.allapot === "DR" && tranzitE(r, csalad, I)) {
            tesz({ tipus: "network", lsId: p.ip, terulet: T, torzs: { maszk: p.maszk, routerek: [a.rid, ...teljesSzomszedok(I).map((n) => n.rid)].sort() } });
          }
        } else {
          const ifId = interfeszAzon(r, p);
          if (I.tipus === "POINT_TO_POINT") {
            for (const n of teljesSzomszedok(I)) linkek.push({ tipus: "p2p", sajatIf: ifId, szomszedIf: n.ifId, szomszed: n.rid, koltseg: k });
            prefixek.push(...elotagok6(p, I, k));
          } else if (I.tipus === "BROADCAST" && tranzitE(r, csalad, I)) {
            const drIf = I.dr.rid === a.rid ? ifId : I.szomszedok.get(I.dr.rid).ifId;
            linkek.push({ tipus: "transit", sajatIf: ifId, drIf, dr: I.dr.rid, koltseg: k });
            if (I.allapot === "DR") {
              tesz({ tipus: "network", lsId: String(ifId), terulet: T, torzs: { routerek: [a.rid, ...teljesSzomszedok(I).map((n) => n.rid)].sort() } });
              tesz({ tipus: "prefix", lsId: String(ifId * 1024), terulet: T, torzs: { ref: "network", refId: String(ifId), prefixek: elotagok6(p, I, 0) } });
            }
          } else {
            prefixek.push(...elotagok6(p, I, k));
          }
          if (I.tipus !== "LOOPBACK") {
            tesz({ tipus: "link", lsId: String(ifId), terulet: T, hatokor: "link", link: nev, torzs: { linkLocal: sajatCim(p, 6), prefixek: elotagok6(p, I, 0).map((x) => x.prefix) } });
          }
        }
      }
      linkek.sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
      tesz({ tipus: "router", lsId: "0", terulet: T, torzs: { linkek, asbr: kulsoAlap } });
      if (csalad === 6) tesz({ tipus: "prefix", lsId: "0", terulet: T, torzs: { ref: "router", refId: "0", prefixek } });
    }
    if (kulsoAlap && teruletek.size) {
      tesz({ tipus: "kulso", lsId: "0.0.0.0", terulet: "K", torzs: { prefix: csalad === 4 ? "0.0.0.0/0" : "::/0", metrika: 1, e2: true, tag: 1 } });
    }
    if (csalad === 4) {
      for (const l of ki.values()) if (l.tipus === "router") l.lsId = a.rid;
    }
    const vegso = /* @__PURE__ */ new Map();
    for (const l of ki.values()) {
      l.kulcs = `${l.tipus}|${l.lsId}|${a.rid}${l.link ? "|" + l.link : ""}`;
      vegso.set(l.kulcs, l);
    }
    return vegso;
  }
  function lsaFrissit(r, csalad) {
    const a = all2(r, csalad);
    if (!a.fut) return;
    const kivant = kivantLsak(r, csalad);
    const kimegy = [];
    for (const [T, db] of a.lsdb) {
      for (const [k, l] of [...db]) {
        if (l.adv !== a.rid || l.maxAge) continue;
        if (!kivant.has(k)) {
          const torolt = { ...l, maxAge: true, sorszam: l.sorszam + 1 };
          a.sorszamok.set(k, torolt.sorszam);
          db.delete(k);
          kimegy.push(torolt);
        }
      }
      void T;
    }
    for (const [k, l] of kivant) {
      const T = l.terulet;
      const db = lsdb(r, csalad, T);
      const regi = db.get(k);
      const ismert = a.sorszamok.get(k) || 0;
      if (regi && JSON.stringify(regi.torzs) === JSON.stringify(l.torzs) && regi.sorszam >= ismert) continue;
      const sorszam = Math.max(ELSO_SORSZAM, Math.max(regi ? regi.sorszam : 0, ismert) + 1);
      const uj = { ...l, adv: a.rid, sorszam, ido: most2(r) };
      a.sorszamok.set(k, uj.sorszam);
      db.set(k, uj);
      kimegy.push(uj);
    }
    if (kimegy.length) {
      elaraszt(r, csalad, kimegy);
      spfUtemez(r, csalad);
    }
  }
  function spfUtemez(r, csalad) {
    const a = all2(r, csalad);
    if (!r.halozat || a.spf) return;
    a.spf = r.halozat.ora.utemez(SPF_KESES, () => {
      a.spf = null;
      spf(r, csalad);
    });
  }
  function routerLsa(db, csalad, rid) {
    return db.get(`router|${csalad === 4 ? rid : "0"}|${rid}`);
  }
  function dijkstra(r, csalad, T, a) {
    const db = lsdb(r, csalad, T);
    const halok = /* @__PURE__ */ new Map();
    for (const l of db.values()) {
      if (l.maxAge || l.tipus !== "network") continue;
      halok.set(csalad === 4 ? l.lsId : `${l.adv}:${l.lsId}`, l);
    }
    const o = ospfBeall(r, csalad);
    const max = o ? o.maxUtak : 4;
    const szomszedai = (csucs) => {
      const ki = [];
      if (csucs.startsWith("R:")) {
        const rid = csucs.slice(2);
        const l = routerLsa(db, csalad, rid);
        if (!l || l.maxAge) return ki;
        for (const e of l.torzs.linkek) {
          if (e.tipus === "p2p") {
            const masik = routerLsa(db, csalad, e.id || e.szomszed);
            const vissza = masik && !masik.maxAge && masik.torzs.linkek.some((x) => x.tipus === "p2p" && (x.id || x.szomszed) === rid);
            if (vissza) ki.push({ csucs: `R:${e.id || e.szomszed}`, koltseg: e.koltseg, el: e });
          } else if (e.tipus === "transit") {
            const azon = csalad === 4 ? e.id : `${e.dr}:${e.drIf}`;
            const n = halok.get(azon);
            if (n && n.torzs.routerek.includes(rid)) ki.push({ csucs: `N:${azon}`, koltseg: e.koltseg, el: e });
          }
        }
      } else {
        const azon = csucs.slice(2);
        const n = halok.get(azon);
        for (const rid of n.torzs.routerek) {
          const l = routerLsa(db, csalad, rid);
          if (!l || l.maxAge) continue;
          const kapcs = l.torzs.linkek.find((x) => x.tipus === "transit" && (csalad === 4 ? x.id === azon : `${x.dr}:${x.drIf}` === azon));
          if (kapcs) ki.push({ csucs: `R:${rid}`, koltseg: 0, el: kapcs });
        }
      }
      return ki;
    };
    const tav = /* @__PURE__ */ new Map([[`R:${a.rid}`, 0]]);
    const elso = /* @__PURE__ */ new Map([[`R:${a.rid}`, []]]);
    const kesz = /* @__PURE__ */ new Set();
    for (; ; ) {
      let min = null;
      for (const [c, d] of tav) if (!kesz.has(c) && (min === null || d < tav.get(min))) min = c;
      if (min === null) break;
      kesz.add(min);
      for (const sz of szomszedai(min)) {
        if (kesz.has(sz.csucs)) continue;
        const d = tav.get(min) + sz.koltseg;
        let ugrasok;
        if (min === `R:${a.rid}`) {
          ugrasok = elsoUgras(r, csalad, sz, null);
        } else if (min.startsWith("N:") && elso.get(min).some((u) => u.kovetkezo === null)) {
          ugrasok = elso.get(min).filter((u) => u.kovetkezo === null).map((u) => elsoUgras(r, csalad, sz, u.port)).flat();
        } else {
          ugrasok = elso.get(min);
        }
        const regi = tav.get(sz.csucs);
        if (regi === void 0 || d < regi) {
          tav.set(sz.csucs, d);
          elso.set(sz.csucs, ugrasok.slice(0, max));
        } else if (d === regi) {
          const l = elso.get(sz.csucs);
          for (const u of ugrasok) if (l.length < max && !l.some((x) => x.port === u.port && x.kovetkezo === u.kovetkezo)) l.push(u);
        }
      }
    }
    return { tav, elso, db };
  }
  function elsoUgras(r, csalad, sz, halozatPort) {
    const a = all2(r, csalad);
    if (halozatPort === null) {
      const port2 = csalad === 4 ? r.portok.find((p) => p.ip === sz.el.adat) : r.portok.find((p) => interfeszAzon(r, p) === sz.el.sajatIf);
      if (!port2 || !a.ifek.has(port2.nev)) return [];
      if (sz.csucs.startsWith("N:")) return [{ port: port2.nev, kovetkezo: null }];
      const n2 = a.ifek.get(port2.nev).szomszedok.get(sz.csucs.slice(2));
      return n2 ? [{ port: port2.nev, kovetkezo: n2.cim }] : [];
    }
    const rid = sz.csucs.slice(2);
    if (rid === a.rid) return [];
    if (csalad === 4) return [{ port: halozatPort, kovetkezo: sz.el.adat }];
    const I = a.ifek.get(halozatPort);
    const n = I && I.szomszedok.get(rid);
    return n ? [{ port: halozatPort, kovetkezo: n.cim }] : [];
  }
  function spf(r, csalad) {
    const a = all2(r, csalad);
    if (!a.fut) {
      a.utvonalak = [];
      return;
    }
    a.spfSzam++;
    a.spfIdo = most2(r);
    const legjobbak = /* @__PURE__ */ new Map();
    const tesz = (prefix, metrika, ugrasok, alKod = "") => {
      if (!ugrasok.length || ugrasok.some((u) => u.kovetkezo === null)) return;
      const regi = legjobbak.get(prefix);
      if (!regi || metrika < regi.metrika) legjobbak.set(prefix, { prefix, metrika, utak: ugrasok.map((u) => ({ ...u })), alKod });
      else if (metrika === regi.metrika) {
        for (const u of ugrasok) if (!regi.utak.some((x) => x.port === u.port && x.kovetkezo === u.kovetkezo)) regi.utak.push({ ...u });
      }
    };
    const elerheto = /* @__PURE__ */ new Map();
    for (const T of a.lsdb.keys()) {
      if (T === "K") continue;
      const { tav, elso, db } = dijkstra(r, csalad, T, a);
      for (const [c, d] of tav) {
        if (c === `R:${a.rid}`) continue;
        const ugr = elso.get(c);
        if (c.startsWith("R:")) {
          const rid = c.slice(2);
          if (!elerheto.has(rid)) elerheto.set(rid, ugr);
          if (csalad === 4) {
            const l = routerLsa(db, 4, rid);
            for (const e of l.torzs.linkek) {
              if (e.tipus !== "stub") continue;
              const hossz = prefixHossz(e.adat);
              tesz(`${ipSzoveg(halozatSzam(ipSzam(e.id), hossz))}/${hossz}`, d + e.koltseg, ugr);
            }
          }
        } else if (csalad === 4) {
          const n = db.get([...db.keys()].find((k) => k.startsWith(`network|${c.slice(2)}|`)));
          if (n) {
            const hossz = prefixHossz(n.torzs.maszk);
            tesz(`${ipSzoveg(halozatSzam(ipSzam(n.lsId), hossz))}/${hossz}`, d, ugr);
          }
        }
      }
      if (csalad === 6) {
        for (const l of db.values()) {
          if (l.maxAge || l.tipus !== "prefix") continue;
          const csucs = l.torzs.ref === "router" ? `R:${l.adv}` : `N:${l.adv}:${l.torzs.refId}`;
          if (!tav.has(csucs) || csucs === `R:${a.rid}`) continue;
          for (const x of l.torzs.prefixek) tesz(x.prefix, tav.get(csucs) + x.metrika, elso.get(csucs));
        }
      }
    }
    for (const l of lsdb(r, csalad, "K").values()) {
      if (l.maxAge || l.adv === a.rid || !elerheto.has(l.adv)) continue;
      tesz(l.torzs.prefix, l.torzs.metrika, elerheto.get(l.adv), "E2");
    }
    const ido = most2(r);
    const ujIdok = /* @__PURE__ */ new Map();
    a.utvonalak = [...legjobbak.values()].map((e) => {
      const [h, hossz] = e.prefix.split("/");
      const alairas = `${e.metrika}|${e.utak.map((u) => u.port + u.kovetkezo).sort().join(",")}`;
      const regi = a.utvonalIdo.get(e.prefix);
      const t = regi && regi.alairas === alairas ? regi.ido : ido;
      ujIdok.set(e.prefix, { alairas, ido: t });
      e.utak.sort((x, y) => x.port < y.port ? -1 : x.port > y.port ? 1 : 0);
      return {
        halozat: csalad === 4 ? ipSzam(h) : ipv6Elemez(h),
        hossz: Number(hossz),
        metrika: e.metrika,
        alKod: e.alKod,
        utak: e.utak.map((u) => ({ port: u.port, kovetkezo: csalad === 4 ? ipSzam(u.kovetkezo) : ipv6Elemez(u.kovetkezo), ido: t }))
      };
    });
    a.utvonalIdo = ujIdok;
    valtozas2(r);
  }
  function leallit(r, csalad, ok) {
    const a = all2(r, csalad);
    for (const nev of [...a.ifek.keys()]) ifLeall(r, csalad, nev, ok);
    a.fut = false;
    a.lsdb = /* @__PURE__ */ new Map();
    a.utvonalak = [];
    a.utvonalIdo = /* @__PURE__ */ new Map();
    a.forrasok = /* @__PURE__ */ new Map();
    if (a.spf && r.halozat) r.halozat.ora.lemond(a.spf);
    a.spf = null;
  }
  function ospfValtozott(r, { csalad } = {}) {
    if (!r.halozat) return;
    for (const c of csalad ? [csalad] : [4, 6]) igazit(r, c);
  }
  function igazit(r, c) {
    const a = all2(r, c);
    const o = ospfBeall(r, c);
    if (!o) {
      if (a.fut) leallit(r, c, "Interface down or detached");
      a.nortrid = false;
      valtozas2(r);
      return;
    }
    if (c === 6 && !r.ipv6Routing) {
      if (a.fut) leallit(r, c, "Interface down or detached");
      return;
    }
    const kell = o.routerId || autoRouterId(r);
    if (!a.fut) {
      if (!kell) {
        if (!a.nortrid) {
          a.nortrid = true;
          naplo2(r, c === 4 ? `%OSPF-4-NORTRID: OSPF process ${o.folyamat} failed to allocate unique router-id and cannot start` : `%OSPFv3-4-NORTRID: OSPFv3 process ${o.folyamat} could not pick a router-id, please configure manually`);
        }
        return;
      }
      a.fut = true;
      a.rid = kell;
      a.indulas = most2(r);
      a.nortrid = false;
    } else if (o.routerId && o.routerId !== a.rid && !vanSzomszed(r, c)) {
      ujraindit(r, c);
      return;
    }
    for (const p of r.portok) {
      const t = ospfTerulet(r, p, c);
      const fent = portFent(p);
      const I = a.ifek.get(p.nev);
      if (!t || !fent) {
        if (I) ifLeall(r, c, p.nev);
        continue;
      }
      const tipus = halozatTipus(p, c);
      const pass = passzivE(r, p, c);
      if (I && (I.terulet !== t.terulet || I.tipus !== tipus || I.passziv !== pass)) {
        ifLeall(r, c, p.nev, "Interface down or detached");
        ifIndit(r, c, p, t.terulet);
        continue;
      }
      if (!I) {
        ifIndit(r, c, p, t.terulet);
        continue;
      }
      I.idok = idokozok(p, c);
      I.mtu = mtu(p, c);
    }
    lsaFrissit(r, c);
    spfUtemez(r, c);
    valtozas2(r);
  }
  function vanSzomszed(r, csalad) {
    const a = all2(r, csalad);
    return [...a.ifek.values()].some((I) => I.szomszedok.size > 0);
  }
  function ujraindit(r, csalad) {
    leallit(r, csalad, "Interface down or detached");
    igazit(r, csalad);
  }
  function ospfTorol(r, csalad) {
    const a = all2(r, csalad);
    if (!a.fut && !ospfBeall(r, csalad)) return;
    a.nortrid = false;
    ujraindit(r, csalad);
  }
  function ospfPortValtozott(h, r) {
    for (const c of [4, 6]) if (ospfBeall(r, c)) igazit(r, c);
  }
  function ospfVanSzomszed(r, csalad) {
    return all2(r, csalad).fut && vanSzomszed(r, csalad);
  }
  function ospfIndit(h) {
    const routerek = h.eszkozok.filter((e) => e.tipus === "router");
    if (!routerek.length) return;
    const lep = () => {
      for (const r of routerek) {
        for (const c of [4, 6]) {
          const a = all2(r, c);
          if (!a.fut) continue;
          const ido = h.ora.ido;
          for (const [nev, I] of [...a.ifek]) {
            const p = r.portok.find((x) => x.nev === nev);
            if (I.allapot === "WAITING" && I.waitVege !== null && ido >= I.waitVege) valasztas(r, c, p, I);
            if (I.passziv || I.tipus === "LOOPBACK") continue;
            for (const n of [...I.szomszedok.values()]) {
              if (ido >= n.deadLejar) {
                szomszedLe(r, c, p, I, n, "Dead timer expired");
                continue;
              }
              if (n.rxmtKov !== null && ido >= n.rxmtKov) {
                if (n.allapot === "EXSTART") dbdKuld(r, c, p, I, n, true);
                else if (n.allapot === "EXCHANGE" && !n.fejlecKapott) dbdKuld(r, c, p, I, n, false);
                else if (n.allapot === "LOADING" && n.keresek.size) lsrKuld(r, c, p, n);
                else n.rxmtKov = null;
              }
            }
            if (a.ifek.get(nev) === I && ido >= I.kovHello) {
              helloKuld(r, c, p, I);
              I.kovHello = ido + I.idok.hello * 1e3;
            }
          }
        }
      }
      h.ora.utemez(1e3, lep);
    };
    h.ora.utemez(1e3, lep);
  }
  function ospfUtvonalak(r, csalad) {
    const a = all2(r, csalad);
    if (!a.fut) return [];
    return a.utvonalak.map((e) => ({ ...e, utak: e.utak.map((u) => ({ ...u })) }));
  }
  function ospfAllapot(r, csalad) {
    const a = all2(r, csalad);
    return {
      fut: a.fut,
      rid: a.rid,
      indulas: a.indulas,
      spfSzam: a.spfSzam,
      spfIdo: a.spfIdo,
      forrasok: [...a.forrasok.entries()].map(([rid, ido]) => ({ rid, ido })),
      ifek: [...a.ifek.values()].map((I) => ({
        ...I,
        szomszedok: [...I.szomszedok.values()].map((n) => ({ ...n, keresek: n.keresek.size }))
      }))
    };
  }
  function szomszedSzerep(I, n) {
    if (I.tipus !== "BROADCAST") return "-";
    if (I.dr && I.dr.rid === n.rid) return "DR";
    if (I.bdr && I.bdr.rid === n.rid) return "BDR";
    return "DROTHER";
  }
  function ospfAdatbazis(r, csalad) {
    const a = all2(r, csalad);
    const teruletek = [];
    let kulso = [];
    for (const [T, db] of a.lsdb) {
      const lsak = [...db.values()].filter((l) => !l.maxAge);
      if (T === "K") kulso = lsak;
      else teruletek.push({ terulet: T, lsak });
    }
    teruletek.sort((x, y) => x.terulet - y.terulet);
    return { teruletek, kulso };
  }
  function lsaKor(r, l) {
    return Math.max(0, Math.floor((most2(r) - l.ido) / 1e3));
  }
  function lsaOsszeg(l) {
    const s = JSON.stringify([l.kulcs, l.sorszam, l.torzs]);
    let x = 0;
    for (let i = 0; i < s.length; i++) x = x * 31 + s.charCodeAt(i) & 65535;
    return `0x00${x.toString(16).toUpperCase().padStart(4, "0")}`;
  }

  // src/mag/utvonal.js
  var AD = { C: 0, L: 0, S: 1, O: 110, R: 120 };
  function portFent(p) {
    if (p.leallitva) return false;
    return p.tipus === "Loopback" ? true : !!p.fent;
  }
  function ipv6Engedelyezve(p) {
    return p.ipv6.length > 0 || !!p.linkLocal || p.ipv6Be;
  }
  function portLinkLocal(p) {
    if (!ipv6Engedelyezve(p)) return null;
    return p.linkLocal ? ipv6Elemez(p.linkLocal) : eui64LinkLocal(p.mac);
  }
  function kapcsolt4(r) {
    const t = [];
    for (const p of r.portok) {
      if (!p.ip || !portFent(p)) continue;
      const ip = ipSzam(p.ip);
      const hossz = prefixHossz(p.maszk);
      t.push({ kod: "C", halozat: halozatSzam(ip, hossz), hossz, ad: 0, metrika: 0, utak: [{ kovetkezo: null, port: p.nev }] });
      if (hossz < 32) t.push({ kod: "L", halozat: ip, hossz: 32, ad: 0, metrika: 0, utak: [{ kovetkezo: null, port: p.nev }] });
    }
    return t;
  }
  function statikus4(r, alap) {
    const t = [];
    for (const s of r.statikus) {
      const halozat = ipSzam(s.halozat);
      const hossz = prefixHossz(s.maszk);
      let ut = null;
      if (s.interfesz) {
        const p = r.portok.find((x) => x.nev === s.interfesz);
        if (p && portFent(p)) ut = { kovetkezo: s.kovetkezo ? ipSzam(s.kovetkezo) : null, port: p.nev };
      } else {
        const kov = ipSzam(s.kovetkezo);
        const talalt = legjobb4(alap, kov);
        if (talalt) ut = { kovetkezo: kov, port: null };
      }
      if (!ut) continue;
      let e = t.find((x) => x.halozat === halozat && x.hossz === hossz);
      if (!e) t.push(e = { kod: "S", halozat, hossz, ad: 1, metrika: 0, utak: [] });
      e.utak.push(ut);
    }
    return t;
  }
  function legjobb4(tabla, ip) {
    let jo = null;
    for (const e of tabla) {
      if (e.lehetLe) continue;
      if (halozatSzam(ip, e.hossz) !== e.halozat) continue;
      if (!jo || e.hossz > jo.hossz) jo = e;
    }
    return jo;
  }
  function tabla4(r, { ospfNelkul = false } = {}) {
    const kapcsolt = kapcsolt4(r);
    const rip = ripUtvonalak(r, 4).map((e) => ({
      kod: "R",
      halozat: e.halozat,
      hossz: e.hossz,
      ad: AD.R,
      metrika: e.metrika,
      utak: e.utak,
      lehetLe: e.le
    }));
    const ospf = ospfNelkul ? [] : ospfUtvonalak(r, 4).map((e) => ({
      kod: "O",
      alKod: e.alKod,
      halozat: e.halozat,
      hossz: e.hossz,
      ad: AD.O,
      metrika: e.metrika,
      utak: e.utak
    }));
    const statikus = statikus4(r, [...kapcsolt, ...ospf, ...rip]);
    const nyertes = /* @__PURE__ */ new Map();
    for (const e of [...kapcsolt, ...statikus, ...ospf, ...rip]) {
      const kulcs2 = `${e.halozat}/${e.hossz}/${e.kod === "L" ? "L" : ""}`;
      const regi = nyertes.get(kulcs2);
      if (!regi || e.ad < regi.ad || regi.lehetLe && !e.lehetLe) nyertes.set(kulcs2, e);
    }
    const t = [...nyertes.values()];
    for (const e of t) e.alap = e.hossz === 0;
    t.sort((a, b) => a.halozat - b.halozat || a.hossz - b.hossz);
    return t;
  }
  var ecmpSzamlalo = /* @__PURE__ */ new WeakMap();
  function utValaszt(r, e) {
    if (e.utak.length === 1) return e.utak[0];
    const n = ecmpSzamlalo.get(r) || 0;
    ecmpSzamlalo.set(r, n + 1);
    return e.utak[n % e.utak.length];
  }
  function keres4(r, ip) {
    const t = tabla4(r);
    let e = legjobb4(t, ip);
    if (!e) return null;
    let ut = utValaszt(r, e);
    let kov = ut.kovetkezo;
    let port2 = ut.port;
    for (let i = 0; !port2 && i < 4; i++) {
      const e2 = legjobb4(t, kov);
      if (!e2) return null;
      const u2 = utValaszt(r, e2);
      port2 = u2.port;
      if (u2.kovetkezo !== null) kov = u2.kovetkezo;
    }
    if (!port2) return null;
    return { port: port2, kovetkezo: kov === null ? ip : kov, bejegyzes: e };
  }
  function utolsoMenedek4(r) {
    const e = tabla4(r).find((x) => x.hossz === 0 && !x.lehetLe);
    return e || null;
  }
  function kapcsolt6(r) {
    const t = [];
    for (const p of r.portok) {
      if (!portFent(p)) continue;
      for (const c of p.ipv6) {
        const cim = ipv6Elemez(c.cim);
        t.push({ kod: "C", halozat: ipv6Halozat(cim, c.hossz), hossz: c.hossz, ad: 0, metrika: 0, utak: [{ kovetkezo: null, port: p.nev }] });
        t.push({ kod: "L", halozat: cim, hossz: 128, ad: 0, metrika: 0, utak: [{ kovetkezo: null, port: p.nev }] });
      }
    }
    return t;
  }
  function legjobb6(tabla, cim) {
    let jo = null;
    for (const e of tabla) {
      if (e.lehetLe) continue;
      if (!ipv6EgyHalozat(cim, e.halozat, e.hossz)) continue;
      if (!jo || e.hossz > jo.hossz) jo = e;
    }
    return jo;
  }
  function statikus6(r, alap) {
    const t = [];
    for (const s of r.statikus6) {
      const pr = ipv6PrefixElemez(s.prefix);
      let ut = null;
      const kov = s.kovetkezo ? ipv6Elemez(s.kovetkezo) : null;
      if (s.interfesz) {
        const p = r.portok.find((x) => x.nev === s.interfesz);
        if (p && portFent(p) && ipv6Engedelyezve(p)) ut = { kovetkezo: kov, port: p.nev };
      } else if (kov && !linkLocalE(kov)) {
        if (legjobb6(alap, kov)) ut = { kovetkezo: kov, port: null };
      }
      if (!ut) continue;
      const halozat = ipv6Halozat(pr.cim, pr.hossz);
      let e = t.find((x) => x.hossz === pr.hossz && ipv6EgyHalozat(x.halozat, halozat, 128));
      if (!e) t.push(e = { kod: "S", halozat, hossz: pr.hossz, ad: 1, metrika: 0, utak: [] });
      e.utak.push(ut);
    }
    return t;
  }
  function tabla6(r, { ospfNelkul = false } = {}) {
    const kapcsolt = kapcsolt6(r);
    const rip = ripUtvonalak(r, 6).map((e) => ({
      kod: "R",
      halozat: e.halozat,
      hossz: e.hossz,
      ad: AD.R,
      metrika: e.metrika,
      utak: e.utak,
      lehetLe: e.le
    }));
    const ospf = ospfNelkul ? [] : ospfUtvonalak(r, 6).map((e) => ({
      kod: "O",
      alKod: e.alKod,
      halozat: e.halozat,
      hossz: e.hossz,
      ad: AD.O,
      metrika: e.metrika,
      utak: e.utak
    }));
    const statikus = statikus6(r, [...kapcsolt, ...ospf, ...rip]);
    const nyertes = /* @__PURE__ */ new Map();
    for (const e of [...kapcsolt, ...statikus, ...ospf, ...rip]) {
      const kulcs2 = `${ipv6Szoveg(e.halozat)}/${e.hossz}`;
      const regi = nyertes.get(kulcs2);
      if (!regi || e.ad < regi.ad) nyertes.set(kulcs2, e);
    }
    const t = [...nyertes.values()];
    const cmp = (a, b) => {
      for (let i = 0; i < 8; i++) if (a.halozat[i] !== b.halozat[i]) return a.halozat[i] - b.halozat[i];
      return a.hossz - b.hossz;
    };
    t.sort(cmp);
    return t;
  }
  function keres6(r, cim) {
    const t = tabla6(r);
    const e = legjobb6(t, cim);
    if (!e) return null;
    let ut = utValaszt(r, e);
    let kov = ut.kovetkezo;
    let port2 = ut.port;
    for (let i = 0; !port2 && i < 4; i++) {
      const e2 = legjobb6(t, kov);
      if (!e2) return null;
      const u2 = utValaszt(r, e2);
      port2 = u2.port;
      if (u2.kovetkezo) kov = u2.kovetkezo;
    }
    if (!port2) return null;
    return { port: port2, kovetkezo: kov || cim, bejegyzes: e };
  }
  function alapNemOspf(r, csalad) {
    if (csalad === 4) return tabla4(r, { ospfNelkul: true }).some((e) => e.hossz === 0 && !e.lehetLe);
    return tabla6(r, { ospfNelkul: true }).some((e) => e.hossz === 0 && !e.lehetLe);
  }
  function bejegyzes(r, szoveg) {
    const [h, l] = String(szoveg).split("/");
    const hossz = Number(l);
    if (h.includes(":")) {
      const c = ipv6Elemez(h);
      if (!c) return null;
      return tabla6(r).find((e) => e.hossz === hossz && ipv6EgyHalozat(e.halozat, c, 128)) || null;
    }
    const n = ipSzam(h);
    return tabla4(r).find((e) => e.hossz === hossz && e.halozat === halozatSzam(n, hossz) && e.kod !== "L") || null;
  }

  // src/mag/router.js
  var CSOPORT4 = ["224.0.0.9", "224.0.0.5", "224.0.0.6"];
  var ROUTER_TTL = 255;
  var ELERHETETLEN_KORLAT = 500;
  var ROUTER_PING_VARAKOZAS = 2e3;
  var belso4 = /* @__PURE__ */ new WeakMap();
  function allapot2(r) {
    let a = belso4.get(r);
    if (!a) belso4.set(r, a = { varok: /* @__PURE__ */ new Map(), sorszam: 1, utolsoElerhetetlen: -Infinity, ndSor: /* @__PURE__ */ new Map() });
    return a;
  }
  function csoportMac(mac) {
    return mac.startsWith("01005e") || mac.startsWith("3333");
  }
  function port(r, nev) {
    return r.portok.find((p) => p.nev === nev);
  }
  function keretKuld(h, r, p, celMac, tipus, adat) {
    h.kuld(r, p, { azon: ujKeretAzon(), forrasMac: p.mac, celMac, tipus, adat });
  }
  function sajat4(r, ip) {
    return r.portok.some((p) => p.ip === ip && portFent(p));
  }
  function sajat62(r, cel, bePort) {
    const c = ipv6Elemez(cel);
    if (!c) return false;
    if (linkLocalE(c)) {
      const ll = bePort && portLinkLocal(bePort);
      return !!ll && ipv6Szoveg(ll) === cel;
    }
    return r.portok.some((p) => portFent(p) && p.ipv6.some((x) => x.cim === cel));
  }
  function portForras6(p) {
    if (p.ipv6.length) return p.ipv6[0].cim;
    const ll = portLinkLocal(p);
    return ll ? ipv6Szoveg(ll) : null;
  }
  function arpKerdez(h, r, p, celIp) {
    keretKuld(h, r, p, SZORAS, "arp", { muvelet: "keres", kuldoMac: p.mac, kuldoIp: p.ip, celMac: "000000000000", celIp });
  }
  function ndKerdez(h, r, p, cel) {
    const c = ipv6Elemez(cel);
    const sn = solicitedNode(c);
    const forras = ipv6Szoveg(portLinkLocal(p));
    keretKuld(h, r, p, ipv6CsoportMac(sn), "ipv6", {
      forras,
      cel: ipv6Szoveg(sn),
      hop: 255,
      protokoll: "icmpv6",
      icmp: { tipus: "ns", cel },
      keses: 0
    });
  }
  function kuld4Porton(h, r, p, kovetkezo, csomag) {
    const b = r.arpTabla[kovetkezo];
    if (b && b.port === p.nev) {
      keretKuld(h, r, p, b.mac, "ipv4", csomag);
      return true;
    }
    arpKerdez(h, r, p, kovetkezo);
    return false;
  }
  var ND_VARAKOZAS = 3e3;
  function kuld6Porton(h, r, p, kovetkezo, csomag) {
    const b = r.ndTabla[kovetkezo];
    if (b && b.port === p.nev) {
      keretKuld(h, r, p, b.mac, "ipv6", csomag);
      return true;
    }
    const a = allapot2(r);
    const kulcs2 = `${p.nev}|${kovetkezo}`;
    let sor2 = a.ndSor.get(kulcs2);
    if (sor2) {
      if (sor2.csomagok.length >= 3) return false;
      sor2.csomagok.push(csomag);
      return true;
    }
    sor2 = { csomagok: [csomag], idozito: null };
    a.ndSor.set(kulcs2, sor2);
    sor2.idozito = h.ora.utemez(ND_VARAKOZAS, () => a.ndSor.delete(kulcs2));
    ndKerdez(h, r, p, kovetkezo);
    return true;
  }
  function ndTanul2(h, r, p, cim, mac) {
    r.ndTabla[cim] = { mac, port: p.nev, ido: h.ora.ido };
    const a = allapot2(r);
    const kulcs2 = `${p.nev}|${cim}`;
    const sor2 = a.ndSor.get(kulcs2);
    if (!sor2) return;
    a.ndSor.delete(kulcs2);
    h.ora.lemond(sor2.idozito);
    for (const cs of sor2.csomagok) keretKuld(h, r, p, mac, "ipv6", cs);
  }
  function routerKuld4(h, r, celIp, adat, { forrasIp, ttl = ROUTER_TTL } = {}) {
    const ut = keres4(r, ipSzam(celIp));
    if (!ut) return false;
    const p = port(r, ut.port);
    return kuld4Porton(h, r, p, ipSzoveg(ut.kovetkezo), { forrasIp: forrasIp || p.ip, celIp, ttl, keses: 0, ...adat });
  }
  function routerKuld6(h, r, cel, adat, { forras, hop = 64 } = {}) {
    const c = ipv6Elemez(cel);
    const ut = keres6(r, c);
    if (!ut) return false;
    const p = port(r, ut.port);
    const src = forras || (linkLocalE(c) ? ipv6Szoveg(portLinkLocal(p)) : portForras6(p));
    return kuld6Porton(h, r, p, ipv6Szoveg(ut.kovetkezo), { forras: src, cel, hop, keses: 0, ...adat });
  }
  function hibaUzenet(csomag) {
    return csomag.icmp && (csomag.icmp.tipus === "ido-lejart" || csomag.icmp.tipus === "elerhetetlen");
  }
  function icmpHiba4(h, r, bePort, csomag, tipus) {
    if (hibaUzenet(csomag) || !bePort.ip) return;
    if (tipus === "elerhetetlen") {
      const a = allapot2(r);
      if (h.ora.ido - a.utolsoElerhetetlen < ELERHETETLEN_KORLAT) return;
      a.utolsoElerhetetlen = h.ora.ido;
    }
    const eredeti = { sorszam: csomag.icmp && csomag.icmp.sorszam, forrasIp: csomag.forrasIp, celIp: csomag.celIp };
    routerKuld4(h, r, csomag.forrasIp, { protokoll: "icmp", icmp: { tipus, eredeti }, keses: csomag.keses || 0 }, { forrasIp: bePort.ip });
  }
  function icmpHiba6(h, r, bePort, csomag, tipus) {
    if (hibaUzenet(csomag)) return;
    if (tipus === "elerhetetlen") {
      const a = allapot2(r);
      if (h.ora.ido - a.utolsoElerhetetlen < ELERHETETLEN_KORLAT) return;
      a.utolsoElerhetetlen = h.ora.ido;
    }
    const eredeti = { sorszam: csomag.icmp && csomag.icmp.sorszam, forras: csomag.forras, cel: csomag.cel };
    routerKuld6(
      h,
      r,
      csomag.forras,
      { protokoll: "icmpv6", icmp: { tipus, eredeti }, keses: csomag.keses || 0 },
      { forras: portForras6(bePort) }
    );
  }
  function routerFogad(h, r, p, keret2) {
    if (keret2.vlan !== void 0) {
      return h.eldob(r, p, keret2, "A router ezen a porton nem ismeri a 802.1Q-címkés keretet (nincs alinterfész).");
    }
    if (keret2.celMac !== p.mac && keret2.celMac !== SZORAS && !csoportMac(keret2.celMac)) return;
    if (!portFent(p)) return;
    h.esemeny({ tipus: "fogadva", eszkoz: r, port: p, keret: keret2 });
    if (keret2.tipus === "arp") return arpFogad(h, r, p, keret2.adat);
    if (keret2.tipus === "ipv4") return ipv4Fogad(h, r, p, keret2.adat, keret2);
    if (keret2.tipus === "ipv6") return ipv6Fogad2(h, r, p, keret2);
    return void 0;
  }
  function arpFogad(h, r, p, arp) {
    if (!p.ip || arp.celIp !== p.ip || arp.kuldoIp === "0.0.0.0") return;
    r.arpTabla[arp.kuldoIp] = { mac: arp.kuldoMac, port: p.nev, ido: h.ora.ido };
    if (arp.muvelet === "keres") {
      keretKuld(h, r, p, arp.kuldoMac, "arp", { muvelet: "valasz", kuldoMac: p.mac, kuldoIp: p.ip, celMac: arp.kuldoMac, celIp: arp.kuldoIp });
    }
  }
  function ipv4Fogad(h, r, p, cs, keret2) {
    if (!p.ip) return;
    if (cs.celIp === "255.255.255.255" || CSOPORT4.includes(cs.celIp) || sajat4(r, cs.celIp)) return helyi4(h, r, p, cs, keret2);
    if (cs.protokoll === "ospf") return;
    const ttl = cs.ttl - 1;
    if (ttl <= 0) return icmpHiba4(h, r, p, cs, "ido-lejart");
    const ut = keres4(r, ipSzam(cs.celIp));
    if (!ut) {
      h.eldob(r, p, { tipus: "ipv4", adat: cs }, `${r.hostname}: nincs útvonal ide: ${cs.celIp} – a router eldobta a csomagot.`);
      return icmpHiba4(h, r, p, cs, "elerhetetlen");
    }
    const ki = port(r, ut.port);
    const kov = ipSzoveg(ut.kovetkezo);
    if (!kuld4Porton(h, r, ki, kov, { ...cs, ttl })) {
      h.eldob(r, ki, { tipus: "ipv4", adat: cs }, `${r.hostname} még nem ismeri ${kov} MAC-címét: ARP-kérdést küldött, ezt a csomagot pedig eldobta.`);
    }
  }
  function helyi4(h, r, p, cs, keret2) {
    if (cs.protokoll === "icmp") {
      const t = cs.icmp.tipus;
      if (t === "echo-keres") {
        routerKuld4(
          h,
          r,
          cs.forrasIp,
          { protokoll: "icmp", icmp: { tipus: "echo-valasz", sorszam: cs.icmp.sorszam }, keses: cs.keses || 0 },
          { forrasIp: cs.celIp }
        );
        return;
      }
      const sorszam = t === "echo-valasz" ? cs.icmp.sorszam : cs.icmp.eredeti && cs.icmp.eredeti.sorszam;
      const v = allapot2(r).varok.get(sorszam);
      if (v) v({ tipus: t, kitol: cs.forrasIp, ttl: cs.ttl, keses: cs.keses || 0 });
      return;
    }
    if (cs.protokoll === "udp" && cs.udp.port === 520) ripFogad4(h, r, p, cs);
    if (cs.protokoll === "ospf") ospfFogad(h, r, p, cs, 4, keret2.forrasMac);
  }
  function ipv6Fogad2(h, r, p, keret2) {
    const cs = keret2.adat;
    if (!ipv6Engedelyezve(p)) return;
    if (cs.protokoll === "icmpv6" && cs.icmp.tipus === "ns") {
      if (!sajat62(r, cs.icmp.cel, p)) return;
      ndTanul2(h, r, p, cs.forras, keret2.forrasMac);
      keretKuld(h, r, p, keret2.forrasMac, "ipv6", {
        forras: cs.icmp.cel,
        cel: cs.forras,
        hop: 255,
        protokoll: "icmpv6",
        icmp: { tipus: "na", cel: cs.icmp.cel },
        keses: 0
      });
      return;
    }
    if (cs.protokoll === "icmpv6" && cs.icmp.tipus === "na") {
      ndTanul2(h, r, p, cs.icmp.cel, keret2.forrasMac);
      return;
    }
    const c = ipv6Elemez(cs.cel);
    if (csoportcimE(c) || sajat62(r, cs.cel, p)) return helyi6(h, r, p, cs, keret2);
    if (!r.ipv6Routing) return;
    const hop = cs.hop - 1;
    if (hop <= 0) return icmpHiba6(h, r, p, cs, "ido-lejart");
    const ut = keres6(r, c);
    if (!ut) {
      h.eldob(r, p, { tipus: "ipv6", adat: cs }, `${r.hostname}: nincs útvonal ide: ${cs.cel} – a router eldobta a csomagot.`);
      return icmpHiba6(h, r, p, cs, "elerhetetlen");
    }
    const ki = port(r, ut.port);
    const kov = ipv6Szoveg(ut.kovetkezo);
    if (!kuld6Porton(h, r, ki, kov, { ...cs, hop })) {
      h.eldob(r, ki, { tipus: "ipv6", adat: cs }, `${r.hostname} még nem ismeri ${kov} MAC-címét, és már túl sok csomag vár rá – ezt eldobta.`);
    }
  }
  function helyi6(h, r, p, cs, keret2) {
    if (cs.forras && linkLocalE(ipv6Elemez(cs.forras))) ndTanul2(h, r, p, cs.forras, keret2.forrasMac);
    if (cs.protokoll === "icmpv6") {
      const t = cs.icmp.tipus;
      if (t === "echo-keres") {
        routerKuld6(
          h,
          r,
          cs.forras,
          { protokoll: "icmpv6", icmp: { tipus: "echo-valasz", sorszam: cs.icmp.sorszam }, keses: cs.keses || 0 },
          { forras: cs.cel }
        );
        return;
      }
      const sorszam = t === "echo-valasz" ? cs.icmp.sorszam : cs.icmp.eredeti && cs.icmp.eredeti.sorszam;
      const v = allapot2(r).varok.get(sorszam);
      if (v) v({ tipus: t, kitol: cs.forras, ttl: cs.hop, keses: cs.keses || 0 });
      return;
    }
    if (cs.protokoll === "udp" && cs.udp.port === 521) ripFogad6(h, r, p, cs);
    if (cs.protokoll === "ospf") ospfFogad(h, r, p, cs, 6, keret2.forrasMac);
  }
  function routerPing(h, r, cel, cb, { ttl, varakozas = ROUTER_PING_VARAKOZAS, forras = null } = {}) {
    const a = allapot2(r);
    const v6 = cel.includes(":");
    const celNormal = v6 ? ipv6Normal(cel) : cel;
    if (v6 ? sajat62(r, celNormal, null) : sajat4(r, celNormal)) {
      return h.ora.utemez(1, () => cb({ fajta: "valasz", kitol: celNormal, keses: 0 }));
    }
    const sorszam = a.sorszam++;
    let kesz = false;
    const vege = (e) => {
      if (kesz) return;
      kesz = true;
      a.varok.delete(sorszam);
      h.ora.lemond(idozito);
      cb(e);
    };
    const idozito = h.ora.utemez(varakozas, () => vege({ fajta: "idotullepes" }));
    a.varok.set(sorszam, (v) => {
      if (v.tipus === "echo-valasz") vege({ fajta: "valasz", kitol: v.kitol, keses: v.keses });
      else if (v.tipus === "ido-lejart") vege({ fajta: "ido-lejart", kitol: v.kitol, keses: v.keses });
      else vege({ fajta: "elerhetetlen", kitol: v.kitol, keses: v.keses });
    });
    if (v6) {
      routerKuld6(h, r, celNormal, { protokoll: "icmpv6", icmp: { tipus: "echo-keres", sorszam } }, { hop: ttl || 64, forras: forras || void 0 });
    } else {
      routerKuld4(h, r, celNormal, { protokoll: "icmp", icmp: { tipus: "echo-keres", sorszam } }, { ttl: ttl || ROUTER_TTL, forrasIp: forras || void 0 });
    }
    return idozito;
  }
  function szomszedTorol(r, portNev) {
    for (const t of [r.arpTabla, r.ndTabla]) {
      for (const k of Object.keys(t)) if (t[k].port === portNev) delete t[k];
    }
  }
  function portHalozataban(p, ip) {
    if (!p.ip) return false;
    const hl = prefixHossz(p.maszk);
    return halozatSzam(ipSzam(p.ip), hl) === halozatSzam(ipSzam(ip), hl);
  }

  // src/mag/halozat.js
  var LINK_FEL_IDO = 1e3;
  var PROTOKOLL_FEL_IDO = 2e3;
  var PROTOKOLL_LE_IDO = 1e3;
  var Halozat = class {
    /**
     * @param {{ora?: Ora, kesleltetes?: number}} [p]
     */
    constructor({ ora, kesleltetes = 1 } = {}) {
      this.ora = ora || new Ora();
      this.kesleltetes = kesleltetes;
      this.eszkozok = [];
      this.kabelek = [];
      this.figyelok = [];
    }
    /** Eszköz hozzáadása. Az eszköz „tudni fogja”, melyik hálózatban van. */
    hozzaad(eszkoz) {
      Object.defineProperty(eszkoz, "halozat", { value: this, enumerable: false, configurable: true });
      this.eszkozok.push(eszkoz);
      return eszkoz;
    }
    /** Eszköz keresése név (hostname) szerint. */
    eszkoz(nev) {
      return this.eszkozok.find((e) => e.hostname === nev);
    }
    /**
     * Kábel két port között. A kábel azonnal működik (nincs „link up” üzenet), ha mindkét
     * vég be van kapcsolva – mintha a hálózat már így indult volna.
     */
    kabel(eszkozA, portNevA, eszkozB, portNevB, { soros = false } = {}) {
      const pa = eszkozA.portok.find((p) => p.nev === portNevA);
      const pb = eszkozB.portok.find((p) => p.nev === portNevB);
      if (!pa || !pb) throw new Error(`Nincs ilyen port: ${eszkozA.hostname} ${portNevA} / ${eszkozB.hostname} ${portNevB}`);
      if (this.kabelVege(eszkozA, pa) || this.kabelVege(eszkozB, pb)) throw new Error("A port már foglalt.");
      const k = { a: { eszkoz: eszkozA, port: pa }, b: { eszkoz: eszkozB, port: pb }, fuggo: [], soros, keses: soros ? 10 : 0, lassu: soros ? 2 : 1 };
      this.kabelek.push(k);
      const fent = !pa.leallitva && !pb.leallitva;
      pa.fent = fent;
      pb.fent = fent;
      return k;
    }
    /** A porthoz csatlakozó kábel, vagy null. */
    kabelVege(eszkoz, port2) {
      return this.kabelek.find((k) => k.a.eszkoz === eszkoz && k.a.port === port2 || k.b.eszkoz === eszkoz && k.b.port === port2) || null;
    }
    /** A kábel túlsó vége: {eszkoz, port}, vagy null, ha nincs kábel. */
    szomszed(eszkoz, port2) {
      const k = this.kabelVege(eszkoz, port2);
      if (!k) return null;
      return k.a.eszkoz === eszkoz && k.a.port === port2 ? k.b : k.a;
    }
    /** Feliratkozás az eseményekre. Visszaad egy függvényt, amivel le lehet iratkozni. */
    figyel(fn) {
      this.figyelok.push(fn);
      return () => {
        this.figyelok = this.figyelok.filter((f) => f !== fn);
      };
    }
    /** @param {Object} e */
    esemeny(e) {
      for (const fn of this.figyelok.slice()) fn(e);
    }
    /** Időbélyeges konzolüzenet egy eszközön (a nézet a konzoljára írja). */
    naplo(eszkoz, uzenet) {
      if (eszkoz.tipus === "pc") return;
      this.esemeny({ tipus: "naplo", eszkoz, sor: `${naploIdobelyeg(this.ora.ido)}: ${uzenet}` });
    }
    /**
     * Keret küldése egy porton. Ha a port nem működik, vagy nincs rajta kábel, a keret elvész.
     * @param {Object} eszkoz
     * @param {Object} port
     * @param {Object} keret
     */
    kuld(eszkoz, port2, keret2) {
      if (!port2.fent) return;
      const k = this.kabelVege(eszkoz, port2);
      if (!k) return;
      const tul = k.a.eszkoz === eszkoz && k.a.port === port2 ? k.b : k.a;
      if (k.keses && keret2.adat && (keret2.tipus === "ipv4" || keret2.tipus === "ipv6")) {
        keret2 = { ...keret2, adat: { ...keret2.adat, keses: (keret2.adat.keses || 0) + k.keses } };
      }
      const ido = this.kesleltetes * k.lassu;
      this.esemeny({ tipus: "keret", honnan: { eszkoz, port: port2 }, hova: tul, keret: keret2, idotartam: ido });
      this.ora.utemez(ido, () => this.fogad(tul.eszkoz, tul.port, keret2));
    }
    /** @private – egy keret megérkezett egy portra */
    fogad(eszkoz, port2, keret2) {
      if (!port2.fent) return;
      if (eszkoz.tipus === "switch") kapcsoloFogad(this, eszkoz, port2, keret2);
      else if (eszkoz.tipus === "router") routerFogad(this, eszkoz, port2, keret2);
      else vegpontFogad(this, eszkoz, port2, keret2);
    }
    /** Eldobott keret (a nézet egy jelet tesz ki, a tanuló láthatja, hol akadt el a csomag). */
    eldob(eszkoz, port2, keret2, ok) {
      this.esemeny({ tipus: "eldobva", eszkoz, port: port2, keret: keret2, ok });
    }
    /**
     * Egy port beállítása megváltozott (shutdown / no shutdown). Kiszámolja, működik-e a kábel,
     * és ha változott, kiírja a konzolüzeneteket – a valódi eszközhöz hasonló időzítéssel.
     */
    portValtozott(eszkoz, port2) {
      const k = this.kabelVege(eszkoz, port2);
      if (!k) {
        if (eszkoz.tipus === "router") {
          if (port2.tipus === "Loopback") {
            const fent = !port2.leallitva;
            if (fent !== port2.fent) {
              port2.fent = fent;
              if (fent) this.naplo(eszkoz, `%LINK-3-UPDOWN: Interface ${port2.nev}, changed state to up`);
              this.naplo(eszkoz, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${port2.nev}, changed state to ${fent ? "up" : "down"}`);
            }
          } else if (!port2.leallitva) {
            this.naplo(eszkoz, `%LINK-3-UPDOWN: Interface ${port2.nev}, changed state to down`);
          }
          ripPortValtozott(this, eszkoz, port2);
          ospfPortValtozott(this, eszkoz);
        }
        this.esemeny({ tipus: "allapot" });
        return;
      }
      for (const e of k.fuggo) this.ora.lemond(e);
      k.fuggo = [];
      const kell = !k.a.port.leallitva && !k.b.port.leallitva;
      const vegek = [k.a, k.b];
      if (!kell) {
        if (k.a.port.fent) {
          for (const v of vegek) {
            v.port.fent = false;
            if (v.eszkoz.tipus === "switch") macTorolPort(v.eszkoz, v.port.nev);
            if (v.eszkoz.tipus === "router") {
              szomszedTorol(v.eszkoz, v.port.nev);
              ripPortValtozott(this, v.eszkoz, v.port);
              ospfPortValtozott(this, v.eszkoz);
            }
            if (!v.port.leallitva) this.naplo(v.eszkoz, `%LINK-3-UPDOWN: Interface ${v.port.nev}, changed state to down`);
          }
          k.fuggo.push(this.ora.utemez(PROTOKOLL_LE_IDO, () => {
            for (const v of vegek) {
              this.naplo(v.eszkoz, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${v.port.nev}, changed state to down`);
            }
          }));
        }
        this.esemeny({ tipus: "allapot" });
        return;
      }
      if (!k.a.port.fent) {
        k.fuggo.push(this.ora.utemez(LINK_FEL_IDO, () => {
          for (const v of vegek) this.naplo(v.eszkoz, `%LINK-3-UPDOWN: Interface ${v.port.nev}, changed state to up`);
        }));
        k.fuggo.push(this.ora.utemez(PROTOKOLL_FEL_IDO, () => {
          for (const v of vegek) {
            v.port.fent = true;
            this.naplo(v.eszkoz, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${v.port.nev}, changed state to up`);
          }
          if (k.a.eszkoz.tipus === "switch") vtpTrunkValtozas(k.a.eszkoz, k.a.port);
          else if (k.b.eszkoz.tipus === "switch") vtpTrunkValtozas(k.b.eszkoz, k.b.port);
          for (const v of vegek) {
            if (v.eszkoz.tipus !== "router") continue;
            ripPortValtozott(this, v.eszkoz, v.port);
            ospfPortValtozott(this, v.eszkoz);
          }
          this.esemeny({ tipus: "allapot" });
        }));
      }
      this.esemeny({ tipus: "allapot" });
    }
  };
  function portValtozott(eszkoz, port2) {
    if (eszkoz.halozat) eszkoz.halozat.portValtozott(eszkoz, port2);
  }

  // src/gyartok/ios/parancsok/interfesz.js
  var INTERFACE_SZO = { szo: "interface", sugo: "Interfész (port) kiválasztása a beállításhoz" };
  var IF_MODOK = ["konfig-if", "konfig-if-tartomany"];
  var interfeszValaszto = {
    modok: ["konfig"],
    szavak: [INTERFACE_SZO, { param: "interfesz", kulcs: "interfesz", sugo: "Az interfész neve" }],
    vegrehajt(ctx, { interfesz }) {
      ctx.modValt("konfig-if", { portok: [interfesz] });
    }
  };
  var interfeszKozos = [
    {
      modok: ["konfig"],
      szavak: [
        INTERFACE_SZO,
        { szo: "range", sugo: "Több interfész kiválasztása egyszerre (pl. fa0/1 - 4)" },
        { param: "interfesz-tartomany", kulcs: "portok", sugo: "Interfészek listája vagy tartománya" }
      ],
      vegrehajt(ctx, { portok }) {
        ctx.modValt("konfig-if-tartomany", { portok });
      }
    },
    {
      modok: IF_MODOK,
      szavak: [{ szo: "shutdown", sugo: "Az interfész lekapcsolása" }],
      vegrehajt(ctx) {
        for (const nev of ctx.kontextus.portok) {
          const p = portKeres(ctx.eszkoz, nev);
          if (!p.leallitva) {
            p.leallitva = true;
            ctx.naplo(`%LINK-5-CHANGED: Interface ${p.nev}, changed state to administratively down`);
            portValtozott(ctx.eszkoz, p);
          }
        }
      }
    },
    {
      modok: IF_MODOK,
      szavak: [SZO.no, { szo: "shutdown", sugo: "Az interfész bekapcsolása" }],
      vegrehajt(ctx) {
        for (const nev of ctx.kontextus.portok) {
          const p = portKeres(ctx.eszkoz, nev);
          if (!p.leallitva) continue;
          p.leallitva = false;
          portValtozott(ctx.eszkoz, p);
        }
      }
    }
  ];
  var interfeszParancsok = [interfeszValaszto, ...interfeszKozos];

  // src/gyartok/ios/kimenetek/vlan-brief.js
  var PORT_OSZLOP_SZELESSEG = 31;
  var BEHUZAS = " ".repeat(4 + 1 + 32 + 1 + 9 + 1);
  function portSorok(portok) {
    const sorok = [];
    let aktualis = "";
    for (const p of portok) {
      const jelolt = aktualis === "" ? p : `${aktualis}, ${p}`;
      if (aktualis !== "" && jelolt.length > PORT_OSZLOP_SZELESSEG) {
        sorok.push(aktualis);
        aktualis = p;
      } else {
        aktualis = jelolt;
      }
    }
    if (aktualis !== "") sorok.push(aktualis);
    return sorok;
  }
  function showVlanBrief(sw) {
    const sorok = [
      "",
      "VLAN Name                             Status    Ports",
      "---- -------------------------------- --------- -------------------------------"
    ];
    const szamok = Object.keys(sw.vlanok).map(Number).sort((a, b) => a - b);
    for (const szam of szamok) {
      const vlan = sw.vlanok[szam];
      const allapot3 = vlan.tamogatott === false ? "act/unsup" : "active";
      const portok = sw.portok.filter((p) => p.accessVlan === szam && uzemmod(sw, p) !== "trunk").map((p) => p.rovid);
      const elso = `${String(szam).padEnd(4)} ${vlan.nev.padEnd(32)} ${allapot3.padEnd(9)} `;
      const ps = portSorok(portok);
      sorok.push((elso + (ps[0] || "")).trimEnd());
      for (const folytatas of ps.slice(1)) sorok.push(BEHUZAS + folytatas);
    }
    return sorok;
  }

  // src/gyartok/ios/kimenetek/running-config.js
  function konfiguracioTorzs(sw) {
    const s = [];
    s.push(
      "!",
      "version 15.0",
      "no service pad",
      "service timestamps debug datetime msec",
      "service timestamps log datetime msec",
      "no service password-encryption",
      "!"
    );
    s.push(`hostname ${sw.hostname}`, "!");
    s.push("boot-start-marker", "boot-end-marker", "!", "!");
    s.push("no aaa new-model", "system mtu routing 1500");
    if (sw.vtpMod === "transparent") {
      if (sw.vtpTartomany) s.push(`vtp domain ${sw.vtpTartomany}`);
      s.push("vtp mode transparent");
    }
    s.push("!", "!", "!", "!", "!", "!");
    s.push("spanning-tree mode pvst", "spanning-tree extend system-id", "!");
    s.push("vlan internal allocation policy ascending", "!");
    if (sw.vtpMod === "transparent") {
      const szamok = Object.keys(sw.vlanok).map(Number).filter((n) => !sw.vlanok[n].gyari).sort((a, b) => a - b);
      for (const n of szamok) {
        s.push(`vlan ${n}`);
        const v = sw.vlanok[n];
        if (v.nev !== "VLAN" + String(n).padStart(4, "0")) s.push(` name ${v.nev}`);
        s.push("!");
      }
    }
    s.push("!", "!", "!", "!", "!");
    for (const p of sw.portok) {
      s.push(`interface ${p.nev}`);
      if (p.accessVlan !== 1) s.push(` switchport access vlan ${p.accessVlan}`);
      if (p.mod === "access") s.push(" switchport mode access");
      else if (p.mod === "trunk") s.push(" switchport mode trunk");
      else if (p.mod === "dinamikus-kezdemenyezo") s.push(" switchport mode dynamic desirable");
      if (p.leallitva) s.push(" shutdown");
      s.push("!");
    }
    s.push("interface Vlan1", " no ip address", " shutdown", "!");
    s.push("ip http server", "ip http secure-server", "!", "!", "!");
    s.push("line con 0", "line vty 0 4", " login", "line vty 5 15", " login", "!", "end");
    return s;
  }
  function showRunningConfig(sw) {
    const torzs = konfiguracioTorzs(sw);
    const bajt = torzs.reduce((osszeg, sor2) => osszeg + sor2.length + 1, 0);
    return ["Building configuration...", "", `Current configuration : ${bajt} bytes`, ...torzs, ""];
  }

  // src/gyartok/ios/kimenetek/interfaces.js
  function vlanListaTomor(szamok) {
    const s = [...szamok].sort((a, b) => a - b);
    const reszek = [];
    for (let i = 0; i < s.length; i++) {
      let j = i;
      while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
      reszek.push(j > i ? `${s[i]}-${s[j]}` : String(s[i]));
      i = j;
    }
    return reszek.join(",");
  }
  var MOD_NEV = { trunk: "on", "dinamikus-auto": "auto", "dinamikus-kezdemenyezo": "desirable" };
  function showInterfacesTrunk(sw) {
    const portok = sw.portok.filter((p) => p.mod === "trunk" || p.mod !== "access" && uzemmod(sw, p) === "trunk");
    if (portok.length === 0) return [];
    const aktivak = Object.keys(sw.vlanok).map(Number).filter((n) => n < 1002 || n > 1005).filter((n) => vlanAktiv(sw, n));
    const sor2 = (port2, szoveg) => `${port2.padEnd(12)}${szoveg}`;
    const s = ["", "Port        Mode             Encapsulation  Status        Native vlan"];
    for (const p of portok) {
      s.push(sor2(p.rovid, `${MOD_NEV[p.mod].padEnd(17)}${"802.1q".padEnd(15)}${(p.fent ? "trunking" : "other").padEnd(14)}${p.nativVlan}`));
    }
    const szakasz = (cim, ertek) => {
      s.push("", sor2("Port", cim));
      for (const p of portok) s.push(sor2(p.rovid, p.fent ? ertek : "none"));
    };
    szakasz("Vlans allowed on trunk", "1-4094");
    szakasz("Vlans allowed and active in management domain", vlanListaTomor(aktivak));
    szakasz("Vlans in spanning tree forwarding state and not pruned", vlanListaTomor(aktivak));
    return s;
  }
  function showInterfacesStatus(sw) {
    const s = ["", "Port      Name               Status       Vlan       Duplex  Speed Type"];
    for (const p of sw.portok) {
      let allapot3;
      if (p.leallitva) allapot3 = "disabled";
      else if (p.fent) allapot3 = "connected";
      else allapot3 = "notconnect";
      const vlan = p.fent && uzemmod(sw, p) === "trunk" ? "trunk" : String(p.accessVlan);
      const giga = p.tipus === "GigabitEthernet";
      const duplex = p.fent ? "a-full" : "auto";
      const sebesseg = p.fent ? giga ? "a-1000" : "a-100" : "auto";
      const tipus = giga ? "10/100/1000BaseTX" : "10/100BaseTX";
      s.push(`${p.rovid.padEnd(9)} ${"".padEnd(18)} ${allapot3.padEnd(12)} ${vlan.padEnd(10)} ${duplex.padStart(6)} ${sebesseg.padStart(6)} ${tipus}`);
    }
    return s;
  }

  // src/gyartok/ios/kimenetek/mac-tabla.js
  var STATIKUS = [
    "0100.0ccc.cccc",
    "0100.0ccc.cccd",
    ...Array.from({ length: 16 }, (_, i) => `0180.c200.00${i.toString(16).padStart(2, "0")}`),
    "0180.c200.0010",
    "ffff.ffff.ffff"
  ];
  function rovidPortnev(nev) {
    const m = /^([A-Za-z]+)(.*)$/.exec(nev);
    return (ROVID_TIPUSNEV[m[1]] || m[1]) + m[2];
  }
  function sor(vlan, mac, tipus, port2) {
    return `${String(vlan).padStart(4)}    ${mac}    ${tipus.padEnd(8)}    ${port2}`;
  }
  function showMacTabla(sw, { csakDinamikus = false } = {}) {
    const s = [
      "          Mac Address Table",
      "-------------------------------------------",
      "",
      "Vlan    Mac Address       Type        Ports",
      "----    -----------       --------    -----"
    ];
    let db = 0;
    if (!csakDinamikus) {
      for (const m of STATIKUS) s.push(sor("All", m, "STATIC", "CPU"));
      db += STATIKUS.length;
    }
    const dinamikus = macTabla(sw).slice().sort((a, b) => a.vlan - b.vlan || a.mac.localeCompare(b.mac));
    for (const b of dinamikus) s.push(sor(b.vlan, macPontos(b.mac), "DYNAMIC", rovidPortnev(b.port)));
    db += dinamikus.length;
    s.push(`Total Mac Addresses for this criterion: ${db}`);
    return s;
  }

  // src/gyartok/ios/parancsok/show.js
  var SHOW = { szo: "show", sugo: "Információk megjelenítése az eszközről" };
  var VLAN = { szo: "vlan", sugo: "A VLAN-ok adatai" };
  var INTERFACES = { szo: "interfaces", sugo: "Az interfészek (portok) állapota" };
  var MAC = { szo: "mac", sugo: "MAC-beállítások" };
  var ADDRESS_TABLE = { szo: "address-table", sugo: "A MAC-címtábla: melyik cím melyik porton és VLAN-ban van" };
  var EXEC = ["felhasznalo", "priv"];
  var showParancsok = [
    {
      modok: ["felhasznalo", "priv"],
      szavak: [SHOW, VLAN, { szo: "brief", sugo: "Rövid összefoglaló: VLAN-ok, állapotuk és portjaik" }],
      lapozhato: true,
      vegrehajt(ctx) {
        ctx.kiir(...showVlanBrief(ctx.eszkoz));
      }
    },
    {
      // A teljes „show vlan” a valódi eszközön működik; a szimulátorban még nincs meg.
      modok: ["felhasznalo", "priv"],
      szavak: [SHOW, VLAN],
      vegrehajt(ctx) {
        ctx.kiir("[Szimulátor] A teljes „show vlan” még nincs meg. Próbáld így: show vlan brief", "");
      }
    },
    {
      modok: ["priv"],
      szavak: [SHOW, { szo: "running-config", sugo: "Az éppen futó (érvényes) konfiguráció" }],
      lapozhato: true,
      vegrehajt(ctx) {
        ctx.kiir(...showRunningConfig(ctx.eszkoz));
      }
    },
    {
      modok: EXEC,
      szavak: [SHOW, INTERFACES, { szo: "trunk", sugo: "A trunk portok: mód, natív VLAN, átengedett VLAN-ok" }],
      lapozhato: true,
      vegrehajt(ctx) {
        ctx.kiir(...showInterfacesTrunk(ctx.eszkoz));
      }
    },
    {
      modok: EXEC,
      szavak: [SHOW, INTERFACES, { szo: "status", sugo: "Összefoglaló: portonként állapot, VLAN, sebesség" }],
      lapozhato: true,
      vegrehajt(ctx) {
        ctx.kiir(...showInterfacesStatus(ctx.eszkoz));
      }
    },
    {
      modok: EXEC,
      szavak: [SHOW, MAC, ADDRESS_TABLE],
      lapozhato: true,
      vegrehajt(ctx) {
        ctx.kiir(...showMacTabla(ctx.eszkoz));
      }
    },
    {
      modok: EXEC,
      szavak: [SHOW, MAC, ADDRESS_TABLE, { szo: "dynamic", sugo: "Csak a megtanult (dinamikus) címek" }],
      lapozhato: true,
      vegrehajt(ctx) {
        ctx.kiir(...showMacTabla(ctx.eszkoz, { csakDinamikus: true }));
      }
    }
  ];

  // src/gyartok/ios/parancsok/switchport.js
  var IF_MODOK2 = ["konfig-if", "konfig-if-tartomany"];
  var SWITCHPORT = { szo: "switchport", sugo: "Kapcsolóport-beállítások (VLAN, üzemmód)" };
  var MODE = { szo: "mode", sugo: "A port üzemmódja (access, trunk …)" };
  var ACCESS = { szo: "access", sugo: "Access mód beállításai" };
  var VLAN2 = { szo: "vlan", sugo: "Melyik VLAN-hoz tartozzon a port access módban" };
  var KITERJESZTETT_TOL2 = 1006;
  function portokra(ctx, fn) {
    for (const nev of ctx.kontextus.portok) {
      const p = portKeres(ctx.eszkoz, nev);
      fn(p);
      macTorolPort(ctx.eszkoz, p.nev);
      const tul = ctx.eszkoz.halozat && ctx.eszkoz.halozat.szomszed(ctx.eszkoz, p);
      if (tul && tul.eszkoz.tipus === "switch") macTorolPort(tul.eszkoz, tul.port.nev);
      portValtozott(ctx.eszkoz, p);
      vtpTrunkValtozas(ctx.eszkoz, p);
    }
  }
  function modParancs(szavak, mod) {
    return {
      modok: IF_MODOK2,
      szavak: [SWITCHPORT, MODE, ...szavak],
      vegrehajt(ctx) {
        portokra(ctx, (p) => {
          p.mod = mod;
        });
      }
    };
  }
  var DYNAMIC = { szo: "dynamic", sugo: "Dinamikus mód: a trunkról a két switch egyezteti (DTP)" };
  var switchportParancsok = [
    modParancs([{ szo: "access", sugo: "Access port: egyetlen VLAN, címke nélküli keretek" }], "access"),
    modParancs([{ szo: "trunk", sugo: "Trunk port: több VLAN forgalma, 802.1Q-címkével" }], "trunk"),
    modParancs([DYNAMIC, { szo: "auto", sugo: "Akkor lesz trunk, ha a túloldal kezdeményezi (gyári érték)" }], "dinamikus-auto"),
    modParancs([DYNAMIC, { szo: "desirable", sugo: "Maga kezdeményezi a trunkot" }], "dinamikus-kezdemenyezo"),
    {
      modok: IF_MODOK2,
      szavak: [SZO.no, SWITCHPORT, { szo: "mode", sugo: "Az üzemmód visszaállítása a gyári értékre (dynamic auto)" }],
      vegrehajt(ctx) {
        portokra(ctx, (p) => {
          p.mod = "dinamikus-auto";
        });
      }
    },
    {
      modok: IF_MODOK2,
      szavak: [SWITCHPORT, ACCESS, VLAN2, { param: "szam", kulcs: "vlan", min: 1, max: 4094, sugo: "A VLAN száma" }],
      vegrehajt(ctx, { vlan }) {
        const sw = ctx.eszkoz;
        if (!sw.vlanok[vlan] && sw.vtpMod !== "client") {
          if (vlan >= KITERJESZTETT_TOL2 && sw.vtpMod !== "transparent") {
            ctx.kiir("Extended VLAN(s) not allowed in current VTP mode.", "%Failed to commit extended VLAN(s) changes.");
            return;
          }
          ctx.kiir(`% Access VLAN does not exist. Creating vlan ${vlan}`);
          sw.vlanok[vlan] = { nev: alapVlanNev(vlan), gyari: false, tamogatott: true };
          vtpVlanValtozas(sw);
        }
        portokra(ctx, (p) => {
          p.accessVlan = vlan;
        });
      }
    },
    {
      modok: IF_MODOK2,
      szavak: [SZO.no, SWITCHPORT, ACCESS, { szo: "vlan", sugo: "Vissza az 1-es VLAN-ba" }],
      vegrehajt(ctx) {
        portokra(ctx, (p) => {
          p.accessVlan = 1;
        });
      }
    }
  ];

  // src/gyartok/ios/kimenetek/vtp-status.js
  var MOD_NEV2 = { server: "Server", client: "Client", transparent: "Transparent" };
  function datum(ms) {
    const mp = Math.floor(ms / 1e3);
    const k = (n) => String(n).padStart(2, "0");
    const nap = 1 + Math.floor(mp / 86400);
    return `3-${nap}-93 ${k(Math.floor(mp % 86400 / 3600))}:${k(Math.floor(mp % 3600 / 60))}:${k(mp % 60)}`;
  }
  function showVtpStatus(sw) {
    const sor2 = (cim, ertek) => `${cim.padEnd(32)}: ${ertek}`.trimEnd();
    const sor22 = (cim, ertek) => `${cim.padEnd(34)}: ${ertek}`.trimEnd();
    const md5 = vtpMd5(sw).map((b) => "0x" + b.toString(16).toUpperCase().padStart(2, "0"));
    const s = [
      sor2("VTP Version capable", "1 to 3"),
      sor2("VTP version running", String(sw.vtpVerzio)),
      sor2("VTP Domain Name", sw.vtpTartomany),
      sor2("VTP Pruning Mode", "Disabled"),
      sor2("VTP Traps Generation", "Disabled"),
      sor2("Device ID", macPontos(sw.mac)),
      `Configuration last modified by 0.0.0.0 at ${sw.vtpModositva === null ? "0-0-00 00:00:00" : datum(sw.vtpModositva)}`
    ];
    if (sw.vtpMod === "server") s.push("Local updater ID is 0.0.0.0 (no valid interface found)");
    s.push(
      "",
      "Feature VLAN:",
      "--------------",
      sor22("VTP Operating Mode", MOD_NEV2[sw.vtpMod]),
      sor22("Maximum VLANs supported locally", "255"),
      sor22("Number of existing VLANs", String(Object.keys(sw.vlanok).length)),
      sor22("Configuration Revision", String(sw.vtpMod === "transparent" ? 0 : sw.vtpRevizio)),
      sor22("MD5 digest", md5.slice(0, 8).join(" ")),
      " ".repeat(36) + md5.slice(8).join(" ")
    );
    if (sw.vtpMd5Hiba) s.push(`*** MD5 digest checksum mismatch on trunk: ${sw.vtpMd5Hiba} ***`);
    return s;
  }
  function showVtpPassword(sw) {
    if (!sw.vtpJelszo) return ["The VTP password is not configured."];
    return [`VTP Password: ${sw.vtpJelszo}`];
  }

  // src/gyartok/ios/parancsok/vtp.js
  var VTP = { szo: "vtp", sugo: "VTP (VLAN Trunking Protocol) beállításai" };
  var MODE2 = { szo: "mode", sugo: "A switch VTP-szerepe" };
  var MOD_NEV3 = { server: "SERVER", client: "CLIENT", transparent: "TRANSPARENT" };
  function modParancs2(mod, sugo2) {
    return {
      modok: ["konfig"],
      szavak: [VTP, MODE2, { szo: mod, sugo: sugo2 }],
      vegrehajt(ctx) {
        const sw = ctx.eszkoz;
        if (sw.vtpMod === mod) {
          ctx.kiir(`Device mode already VTP ${MOD_NEV3[mod]}.`);
          return;
        }
        sw.vtpMod = mod;
        if (mod === "transparent") sw.vtpRevizio = 0;
        ctx.kiir(`Setting device to VTP ${MOD_NEV3[mod]} mode.`);
        vtpBeallitasValtozas(sw);
      }
    };
  }
  var vtpParancsok = [
    modParancs2("server", "Server: VLAN-okat hoz létre és hirdet (gyári érték)"),
    modParancs2("client", "Client: a serverek hirdetéséből veszi át a VLAN-okat, maga nem módosíthat"),
    modParancs2("transparent", "Transparent: saját, helyi VLAN-ok; mások hirdetését csak továbbengedi"),
    {
      modok: ["konfig"],
      szavak: [
        VTP,
        { szo: "domain", sugo: "A VTP-tartomány neve" },
        { param: "szo", kulcs: "nev", maxHossz: 32, sugo: "A tartomány neve (legfeljebb 32 karakter, kis- és nagybetű számít)" }
      ],
      vegrehajt(ctx, { nev }) {
        const sw = ctx.eszkoz;
        if (sw.vtpTartomany === nev) {
          ctx.kiir(`Domain name already set to ${nev}.`);
          return;
        }
        ctx.kiir(`Changing VTP domain name from ${sw.vtpTartomany || "NULL"} to ${nev}`);
        sw.vtpTartomany = nev;
        sw.vtpRevizio = 0;
        vtpBeallitasValtozas(sw);
      }
    },
    {
      modok: ["konfig"],
      szavak: [
        VTP,
        { szo: "password", sugo: "A VTP-jelszó (a tartomány minden switchén azonos legyen)" },
        { param: "szo", kulcs: "jelszo", maxHossz: 64, sugo: "A jelszó (szóköz nélkül)" }
      ],
      vegrehajt(ctx, { jelszo }) {
        ctx.eszkoz.vtpJelszo = jelszo;
        ctx.kiir(`Setting device VLAN database password to ${jelszo}`);
        vtpBeallitasValtozas(ctx.eszkoz);
      }
    },
    {
      modok: ["konfig"],
      szavak: [SZO.no, VTP, { szo: "password", sugo: "A VTP-jelszó törlése" }],
      vegrehajt(ctx) {
        ctx.eszkoz.vtpJelszo = "";
        ctx.kiir("Clearing device VLAN database password.");
        vtpBeallitasValtozas(ctx.eszkoz);
      }
    },
    {
      modok: ["konfig"],
      szavak: [
        VTP,
        { szo: "version", sugo: "A VTP verziója" },
        { param: "szam", kulcs: "verzio", min: 1, max: 3, sugo: "A verzió (1, 2 vagy 3)" }
      ],
      vegrehajt(ctx, { verzio }) {
        const sw = ctx.eszkoz;
        if (verzio === 3) {
          ctx.kiir("[Szimulátor] A VTP 3-as verziója a szimulátorban még nincs meg. Használd a 2-est: vtp version 2", "");
          return;
        }
        if (sw.vtpMod === "client") {
          ctx.kiir("Cannot modify version in VTP client mode");
          return;
        }
        if (sw.vtpVerzio === verzio) return;
        sw.vtpVerzio = verzio;
        if (sw.vtpMod === "server") vtpVlanValtozas(sw);
      }
    },
    {
      modok: ["felhasznalo", "priv"],
      szavak: [
        { szo: "show", sugo: "Információk megjelenítése az eszközről" },
        VTP,
        { szo: "status", sugo: "A VTP állapota: szerep, tartomány, verzió, revíziószám" }
      ],
      vegrehajt(ctx) {
        ctx.kiir(...showVtpStatus(ctx.eszkoz));
      }
    },
    {
      modok: ["priv"],
      szavak: [
        { szo: "show", sugo: "Információk megjelenítése az eszközről" },
        VTP,
        { szo: "password", sugo: "A beállított VTP-jelszó" }
      ],
      vegrehajt(ctx) {
        ctx.kiir(...showVtpPassword(ctx.eszkoz));
      }
    }
  ];

  // src/gyartok/ios/parancsok/meg-nincs.js
  var MEG_NINCS = "(a szimulátorban még nincs meg)";
  var LISTA = {
    felhasznalo: ["connect", "disconnect", "ping", "ssh", "telnet", "terminal", "traceroute", "show interfaces", "show vtp counters"],
    priv: [
      "clear",
      "clock",
      "connect",
      "copy",
      "debug",
      "delete",
      "dir",
      "disconnect",
      "erase",
      "more",
      "ping",
      "reload",
      "setup",
      "ssh",
      "telnet",
      "terminal",
      "traceroute",
      "undebug",
      "write",
      "show interfaces",
      "show vtp counters"
    ],
    konfig: [
      "aaa",
      "access-list",
      "banner",
      "boot",
      "cdp",
      "clock",
      "crypto",
      "default",
      "enable",
      "ip",
      "line",
      "logging",
      "mac",
      "ntp",
      "service",
      "snmp-server",
      "spanning-tree",
      "username",
      "vtp pruning",
      "vtp interface",
      "vtp file"
    ],
    "konfig-if": [
      "cdp",
      "channel-group",
      "description",
      "duplex",
      "ip",
      "spanning-tree",
      "speed",
      "switchport trunk",
      "switchport nonegotiate",
      "switchport port-security",
      "switchport voice"
    ],
    "konfig-if-tartomany": [
      "cdp",
      "channel-group",
      "description",
      "duplex",
      "spanning-tree",
      "speed",
      "switchport trunk",
      "switchport nonegotiate",
      "switchport port-security",
      "switchport voice"
    ]
  };
  function megNincsBol(lista3) {
    return Object.entries(lista3).flatMap(
      ([mod, nevek]) => nevek.map((nev) => ({
        modok: [mod],
        // Csak az utolsó szó új; az előtte lévők (pl. switchport) már meglévő parancsok szavai.
        szavak: nev.split(" ").map((szo) => ({ szo, sugo: MEG_NINCS })),
        nincsMeg: true,
        vegrehajt(ctx) {
          ctx.kiir(`[Szimulátor] A(z) „${nev}” parancs a valódi eszközön létezik, de a szimulátorban még nincs meg.`, "");
        }
      }))
    );
  }
  var megNincsParancsok = megNincsBol(LISTA);
  var routerMegNincsParancsok = megNincsBol({
    felhasznalo: [
      "connect",
      "disconnect",
      "ssh",
      "telnet",
      "terminal",
      "show interfaces",
      "show version",
      "show clock",
      "show cdp",
      "show ipv6 neighbors",
      "show ip eigrp"
    ],
    priv: [
      "clock",
      "connect",
      "copy",
      "delete",
      "dir",
      "disconnect",
      "erase",
      "more",
      "reload",
      "setup",
      "ssh",
      "telnet",
      "terminal",
      "show interfaces",
      "show version",
      "show clock",
      "show cdp",
      "show startup-config",
      "show ipv6 neighbors",
      "show ip eigrp",
      "debug ip icmp",
      "debug ip ospf events",
      "debug ip ospf packet",
      "clear arp-cache",
      "clear ip ospf counters"
    ],
    konfig: [
      "aaa",
      "access-list",
      "banner",
      "boot",
      "cdp",
      "clock",
      "crypto",
      "enable",
      "line",
      "logging",
      "ntp",
      "service",
      "snmp-server",
      "username",
      "ip dhcp",
      "ip domain-name",
      "ip nat",
      "ip ssh",
      "ip access-list",
      "ip name-server",
      "router eigrp",
      "router bgp",
      "ipv6 dhcp",
      "ipv6 access-list"
    ],
    "konfig-if": [
      "cdp",
      "duplex",
      "speed",
      "encapsulation",
      "ip nat",
      "ip helper-address",
      "ip access-group",
      "ip summary-address",
      "ipv6 nd",
      "ip ospf retransmit-interval",
      "ip ospf transmit-delay",
      "ipv6 ospf retransmit-interval",
      "ipv6 ospf transmit-delay"
    ],
    "konfig-router": ["distance", "distribute-list", "maximum-paths", "neighbor", "offset-list", "redistribute"],
    "konfig-rtr": ["distance", "maximum-paths", "redistribute", "split-horizon", "poison-reverse", "timers"],
    "konfig-ospf": ["area", "distance", "distribute-list", "log-adjacency-changes", "neighbor", "redistribute", "summary-address", "timers"],
    "konfig-ospf6": ["area", "distance", "log-adjacency-changes", "redistribute", "summary-prefix", "timers"]
  });

  // src/modell/router.js
  var ALAP_ROUTER_HOSTNAME = "Router";
  var ROUTER_ROVID = { GigabitEthernet: "Gi", Serial: "Se", Loopback: "Lo" };
  var LOOPBACK_MAX = 99;
  function ujOspfPort() {
    return { folyamat: null, terulet: null, koltseg: null, prioritas: 1, halozatTipus: "", hello: null, dead: null, hitelesites: "", kulcsok: {}, jelszo: "" };
  }
  function ujPort2(hostname, tipus, szam) {
    return {
      nev: tipus + szam,
      rovid: ROUTER_ROVID[tipus] + szam,
      tipus,
      szam,
      leallitva: tipus !== "Loopback",
      fent: false,
      mac: macNevbol(`router:${hostname}:${tipus}${szam}`),
      ip: "",
      maszk: "",
      ipv6: [],
      linkLocal: "",
      ipv6Be: false,
      ripng: "",
      ripngAlap: "",
      ospf: ujOspfPort(),
      ospf6: ujOspfPort(),
      mtu: null,
      mtu6: null,
      leiras: ""
    };
  }
  function ujRip() {
    return {
      verzio: null,
      halozatok: [],
      passziv: [],
      autoSummary: true,
      alapUtvonal: false,
      idozitok: { frissites: 30, ervenytelen: 180, visszatartas: 180, torles: 240 }
    };
  }
  function ujOspf(folyamat) {
    return { folyamat, routerId: "", halozatok: [], passziv: [], passzivAlap: false, nemPassziv: [], referencia: 100, alapUtvonal: "", maxUtak: 4 };
  }
  function ujRouter4331(b = {}) {
    const hostname = b.hostname || ALAP_ROUTER_HOSTNAME;
    const portok = [];
    for (let i = 0; i <= 2; i++) portok.push(ujPort2(hostname, "GigabitEthernet", `0/0/${i}`));
    for (let i = 0; i <= 1; i++) portok.push(ujPort2(hostname, "Serial", `0/1/${i}`));
    return {
      tipus: "router",
      modell: "ISR4331",
      hostname,
      portok,
      /** IPv4 ARP-gyorstár: ip → { mac, port, ido } */
      arpTabla: {},
      /** IPv6-szomszédok (ND): cím (normál alak) → { mac, port, ido } */
      ndTabla: {},
      /** ip route: { halozat, maszk, kovetkezo?, interfesz? } (szövegként) */
      statikus: [],
      /** ipv6 route: { prefix: 'X::/n', kovetkezo?, interfesz? } */
      statikus6: [],
      ipv6Routing: false,
      /** @type {RipBeallitas|null} */
      rip: null,
      /** RIPng-folyamatok: név → {} (a beállítások az interfészeken vannak) */
      ripng: {},
      /** @type {OspfBeallitas|null} router ospf N */
      ospf: null,
      /** @type {OspfBeallitas|null} ipv6 router ospf N */
      ospf6: null,
      /** debug ip rip, debug ipv6 rip, debug ip ospf hello/adj, debug ipv6 ospf hello/adj */
      debug: { rip: false, ripng: false, ospfHello: false, ospfAdj: false, ospf6Hello: false, ospf6Adj: false }
    };
  }
  function routerPort(r, nev) {
    return r.portok.find((p) => p.nev === nev);
  }
  function loopbackLetrehoz(r, szam) {
    const nev = `Loopback${szam}`;
    let p = routerPort(r, nev);
    if (!p) {
      p = ujPort2(r.hostname, "Loopback", String(szam));
      p.fent = true;
      r.portok.push(p);
      r.portok.sort(portSorrend);
    }
    return p;
  }
  var TIPUS_SORREND = { GigabitEthernet: 0, Serial: 1, Loopback: 2 };
  function portSorrend(a, b) {
    if (a.tipus !== b.tipus) return TIPUS_SORREND[a.tipus] - TIPUS_SORREND[b.tipus];
    const x = a.szam.split("/").map(Number);
    const y = b.szam.split("/").map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
    return 0;
  }
  function routerPortTipusok(r) {
    const e = {};
    for (const p of r.portok) if (p.tipus !== "Loopback") (e[p.tipus] = e[p.tipus] || []).push(p.szam);
    e.Loopback = [];
    for (let i = 0; i <= LOOPBACK_MAX; i++) e.Loopback.push(String(i));
    return e;
  }

  // src/gyartok/ios/parancsok/router.js
  var IP = { szo: "ip", sugo: "IPv4-beállítások" };
  var IPV6 = { szo: "ipv6", sugo: "IPv6-beállítások" };
  var ADDRESS = { szo: "address", sugo: "Az interfész címe" };
  var ROUTE = { szo: "route", sugo: "Statikus útvonal" };
  var RIP = { szo: "rip", sugo: "RIP (Routing Information Protocol)" };
  var ROUTER = { szo: "router", sugo: "Forgalomirányító protokoll indítása / beállítása" };
  var IF_MODOK3 = ["konfig-if", "konfig-if-tartomany"];
  var EGY_IF = ["konfig-if"];
  function portjai(ctx) {
    return ctx.kontextus.portok.map((n) => routerPort(ctx.eszkoz, n)).filter(Boolean);
  }
  function valtozott(ctx, b) {
    ripValtozott(ctx.eszkoz, b);
    ospfValtozott(ctx.eszkoz);
    if (ctx.eszkoz.halozat) ctx.eszkoz.halozat.esemeny({ tipus: "allapot" });
  }
  function hexMaszk(m) {
    return "0x" + (ipSzam(m) >>> 0).toString(16).toUpperCase().padStart(8, "0");
  }
  var interfeszParancsokR = [
    {
      modok: ["konfig"],
      szavak: [{ szo: "interface", sugo: "Interfész (port) kiválasztása a beállításhoz" }, { param: "interfesz", kulcs: "interfesz", sugo: "Az interfész neve" }],
      vegrehajt(ctx, { interfesz }) {
        if (/^Loopback/.test(interfesz) && !routerPort(ctx.eszkoz, interfesz)) {
          loopbackLetrehoz(ctx.eszkoz, Number(interfesz.slice(8)));
          ctx.naplo(`%LINK-3-UPDOWN: Interface ${interfesz}, changed state to up`);
          ctx.naplo(`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${interfesz}, changed state to up`);
          valtozott(ctx);
        }
        ctx.modValt("konfig-if", { portok: [interfesz] });
      }
    },
    {
      modok: EGY_IF,
      szavak: [IP, ADDRESS, { param: "ipv4", kulcs: "cim", sugo: "IP-cím" }, { param: "ipv4", kulcs: "maszk", sugo: "Alhálózati maszk" }],
      vegrehajt(ctx, { cim, maszk }) {
        const p = portjai(ctx)[0];
        if (!ervenyesMaszk(maszk)) {
          ctx.kiir(`Bad mask ${hexMaszk(maszk)} for address ${cim}`);
          return;
        }
        const h = prefixHossz(maszk);
        const n = ipSzam(cim);
        const elso = n >>> 24;
        if (h < 31 && ((n & ~maszkSzam(h)) >>> 0 === 0 || (n | ~maszkSzam(h)) >>> 0 === 4294967295)) {
          ctx.kiir(`Bad mask /${h} for address ${cim}`);
          return;
        }
        if (elso === 0 || elso === 127 || elso >= 224) {
          ctx.kiir(`Not a valid host address - ${cim}`);
          return;
        }
        for (const q of ctx.eszkoz.portok) {
          if (q === p || !q.ip) continue;
          const hq = Math.min(h, prefixHossz(q.maszk));
          if (halozatSzam(ipSzam(q.ip), hq) === halozatSzam(n, hq)) {
            ctx.kiir(`% ${ipSzoveg(halozatSzam(n, h))} overlaps with ${q.nev}`);
            return;
          }
        }
        p.ip = cim;
        p.maszk = maszk;
        for (const k of Object.keys(ctx.eszkoz.arpTabla)) if (ctx.eszkoz.arpTabla[k].port === p.nev) delete ctx.eszkoz.arpTabla[k];
        valtozott(ctx, { keres: true, csalad: 4 });
      }
    },
    {
      modok: IF_MODOK3,
      szavak: [SZO.no, IP, { szo: "address", sugo: "Az IPv4-cím törlése" }],
      vegrehajt(ctx) {
        for (const p of portjai(ctx)) {
          p.ip = "";
          p.maszk = "";
        }
        valtozott(ctx, { csalad: 4 });
      }
    },
    {
      // ipv6 address 2001:DB8:ACAD:1::1/64
      modok: EGY_IF,
      szavak: [IPV6, ADDRESS, { param: "ipv6-prefix", kulcs: "pr", sugo: "IPv6-cím és előtaghossz (pl. 2001:DB8:1::1/64)" }],
      vegrehajt(ctx, { pr }) {
        const p = portjai(ctx)[0];
        const c = ipv6Elemez(pr.cim);
        if (linkLocalE(c)) {
          ctx.kiir("% Use the link-local keyword to configure a link-local address");
          return;
        }
        if (csoportcimE(c) || pr.hossz === 0) {
          ctx.kiir(`% Invalid address ${pr.cim}/${pr.hossz}`);
          return;
        }
        for (const q of ctx.eszkoz.portok) {
          if (q === p) continue;
          for (const x of q.ipv6) {
            const hl = Math.min(x.hossz, pr.hossz);
            if (ipv6EgyHalozat(ipv6Elemez(x.cim), c, hl)) {
              ctx.kiir(`% ${ipv6Szoveg(ipv6Halozat(c, pr.hossz))}/${pr.hossz} overlaps with ${q.nev}`);
              return;
            }
          }
        }
        if (!p.ipv6.some((x) => x.cim === pr.cim)) p.ipv6.push({ cim: pr.cim, hossz: pr.hossz });
        valtozott(ctx, { keres: true, csalad: 6 });
      }
    },
    {
      // ipv6 address FE80::1 link-local
      modok: IF_MODOK3,
      szavak: [
        IPV6,
        ADDRESS,
        { param: "ipv6", kulcs: "cim", sugo: "IPv6-cím (link-local címhez)" },
        { szo: "link-local", sugo: "Ez a cím legyen az interfész link-local címe" }
      ],
      vegrehajt(ctx, { cim }) {
        if (!linkLocalE(ipv6Elemez(cim))) {
          ctx.kiir(`% Invalid link-local address ${cim}`);
          return;
        }
        for (const p of portjai(ctx)) p.linkLocal = cim;
        valtozott(ctx, { keres: true, csalad: 6 });
      }
    },
    {
      modok: IF_MODOK3,
      szavak: [SZO.no, IPV6, { szo: "address", sugo: "Az IPv6-címek törlése" }],
      vegrehajt(ctx) {
        for (const p of portjai(ctx)) {
          p.ipv6 = [];
          p.linkLocal = "";
        }
        valtozott(ctx, { csalad: 6 });
      }
    },
    {
      modok: IF_MODOK3,
      szavak: [SZO.no, IPV6, ADDRESS, { param: "ipv6-prefix", kulcs: "pr", sugo: "A törlendő IPv6-cím" }],
      vegrehajt(ctx, { pr }) {
        for (const p of portjai(ctx)) p.ipv6 = p.ipv6.filter((x) => !(x.cim === pr.cim && x.hossz === pr.hossz));
        valtozott(ctx, { csalad: 6 });
      }
    },
    {
      modok: IF_MODOK3,
      szavak: [IPV6, { szo: "enable", sugo: "IPv6 bekapcsolása (csak link-local címmel)" }],
      vegrehajt(ctx) {
        for (const p of portjai(ctx)) p.ipv6Be = true;
        valtozott(ctx, { keres: true, csalad: 6 });
      }
    },
    {
      modok: IF_MODOK3,
      szavak: [SZO.no, IPV6, { szo: "enable", sugo: "Az IPv6 kikapcsolása (ha nincs globális cím)" }],
      vegrehajt(ctx) {
        for (const p of portjai(ctx)) p.ipv6Be = false;
        valtozott(ctx, { csalad: 6 });
      }
    },
    {
      modok: IF_MODOK3,
      szavak: [
        IPV6,
        { szo: "rip", sugo: "RIPng ezen az interfészen" },
        { param: "szo", kulcs: "nev", nev: "WORD", sugo: "A RIPng-folyamat neve" },
        { szo: "enable", sugo: "RIPng bekapcsolása ezen az interfészen" }
      ],
      vegrehajt(ctx, { nev }) {
        const r = ctx.eszkoz;
        if (!r.ipv6Routing) {
          ctx.kiir("% IPv6 routing not enabled");
          return;
        }
        if (!r.ripng[nev]) r.ripng[nev] = {};
        for (const p of portjai(ctx)) p.ripng = nev;
        valtozott(ctx, { keres: true, csalad: 6 });
      }
    },
    {
      modok: IF_MODOK3,
      szavak: [
        SZO.no,
        IPV6,
        { szo: "rip", sugo: "RIPng ezen az interfészen" },
        { param: "szo", kulcs: "nev", nev: "WORD", sugo: "A RIPng-folyamat neve" },
        { szo: "enable", sugo: "RIPng kikapcsolása ezen az interfészen" }
      ],
      vegrehajt(ctx, { nev }) {
        for (const p of portjai(ctx)) {
          if (p.ripng === nev) {
            p.ripng = "";
            p.ripngAlap = "";
          }
        }
        valtozott(ctx, { csalad: 6 });
      }
    },
    ...["originate", "only"].map((mit) => ({
      modok: IF_MODOK3,
      szavak: [
        IPV6,
        { szo: "rip", sugo: "RIPng ezen az interfészen" },
        { param: "szo", kulcs: "nev", nev: "WORD", sugo: "A RIPng-folyamat neve" },
        { szo: "default-information", sugo: "Alapértelmezett útvonal (::/0) hirdetése ezen az interfészen" },
        mit === "originate" ? { szo: "originate", sugo: "A ::/0 hirdetése a többi útvonallal együtt" } : { szo: "only", sugo: "Csak a ::/0 hirdetése (a többi útvonal nélkül)" }
      ],
      vegrehajt(ctx, { nev }) {
        const r = ctx.eszkoz;
        if (!r.ipv6Routing) {
          ctx.kiir("% IPv6 routing not enabled");
          return;
        }
        if (!r.ripng[nev]) r.ripng[nev] = {};
        for (const p of portjai(ctx)) {
          if (p.ripng && p.ripng !== nev) continue;
          p.ripngAlap = mit;
        }
        valtozott(ctx, { csalad: 6 });
      }
    })),
    {
      modok: IF_MODOK3,
      szavak: [
        SZO.no,
        IPV6,
        { szo: "rip", sugo: "RIPng ezen az interfészen" },
        { param: "szo", kulcs: "nev", nev: "WORD", sugo: "A RIPng-folyamat neve" },
        { szo: "default-information", sugo: "Az alapértelmezett útvonal hirdetésének kikapcsolása" }
      ],
      vegrehajt(ctx) {
        for (const p of portjai(ctx)) p.ripngAlap = "";
        valtozott(ctx, { csalad: 6 });
      }
    },
    {
      modok: IF_MODOK3,
      szavak: [
        { szo: "clock", sugo: "Órajel (soros vonal DCE oldalán)" },
        { szo: "rate", sugo: "Az órajel sebessége" },
        { param: "szam", kulcs: "n", min: 1200, max: 8e6, nev: "<1200-8000000>", sugo: "Bit/másodperc" }
      ],
      vegrehajt(ctx, { n }) {
        for (const p of portjai(ctx)) {
          if (p.tipus !== "Serial") {
            ctx.kiir("[Szimulátor] Órajelet csak soros interfészen lehet megadni.");
            continue;
          }
          p.orajel = n;
        }
      }
    },
    {
      modok: IF_MODOK3,
      szavak: [
        { szo: "bandwidth", sugo: "Az interfész sávszélessége (a protokollok számolnak vele, a RIP nem)" },
        { param: "szam", kulcs: "n", min: 1, max: 1e7, nev: "<1-10000000>", sugo: "Sávszélesség kbit/s-ban" }
      ],
      vegrehajt(ctx, { n }) {
        for (const p of portjai(ctx)) p.savszel = n;
      }
    },
    {
      modok: IF_MODOK3,
      szavak: [SZO.no, { szo: "bandwidth", sugo: "A sávszélesség visszaállítása az alapértékre" }],
      vegrehajt(ctx) {
        for (const p of portjai(ctx)) delete p.savszel;
      }
    }
  ];
  var KOVETKEZO4 = { param: "ipv4", kulcs: "kovetkezo", sugo: "A következő ugrás (szomszéd router) címe" };
  var KIMENO = { param: "interfesz", kulcs: "interfesz", sugo: "A kimenő interfész" };
  function ipRoute(ctx, { halozat, maszk, kovetkezo, interfesz }, torol) {
    const r = ctx.eszkoz;
    if (!ervenyesMaszk(maszk) && maszk !== "0.0.0.0") {
      ctx.kiir("%Inconsistent address and mask");
      return;
    }
    const h = prefixHossz(maszk);
    if (halozatSzam(ipSzam(halozat), h) !== ipSzam(halozat)) {
      ctx.kiir("%Inconsistent address and mask");
      return;
    }
    if (interfesz && !routerPort(r, interfesz)) {
      ctx.kiir("% Interface not found");
      return;
    }
    const egyezik = (s) => s.halozat === halozat && s.maszk === maszk && (s.kovetkezo || null) === (kovetkezo || null) && (s.interfesz || null) === (interfesz || null);
    if (torol) {
      const elotte = r.statikus.length;
      r.statikus = r.statikus.filter((s) => !egyezik(s));
      if (r.statikus.length === elotte) ctx.kiir("%No matching route to delete");
    } else {
      if (kovetkezo && r.portok.some((p) => p.ip === kovetkezo)) {
        ctx.kiir("%Invalid next hop address (it's this router)");
        return;
      }
      if (!r.statikus.some(egyezik)) r.statikus.push({ halozat, maszk, kovetkezo, interfesz });
    }
    valtozott(ctx, { csalad: 4 });
  }
  function ipv6Route(ctx, { pr, kovetkezo, interfesz }, torol) {
    const r = ctx.eszkoz;
    if (kovetkezo && linkLocalE(ipv6Elemez(kovetkezo)) && !interfesz) {
      ctx.kiir("% Interface has to be specified for a link-local nexthop");
      return;
    }
    const halozat = ipv6Elemez(pr.cim);
    const prefix = `${ipv6Szoveg(ipv6Halozat(halozat, pr.hossz))}/${pr.hossz}`;
    const egyezik = (s) => s.prefix === prefix && (s.kovetkezo || null) === (kovetkezo || null) && (s.interfesz || null) === (interfesz || null);
    if (torol) {
      const elotte = r.statikus6.length;
      r.statikus6 = r.statikus6.filter((s) => !egyezik(s));
      if (r.statikus6.length === elotte) ctx.kiir("%No matching route to delete");
    } else if (!r.statikus6.some(egyezik)) {
      r.statikus6.push({ prefix, kovetkezo, interfesz });
    }
    valtozott(ctx, { csalad: 6 });
  }
  function utvonalParancsok() {
    const l = [];
    for (const torol of [false, true]) {
      const eleje = torol ? [SZO.no, IP, ROUTE] : [IP, ROUTE];
      const cel = [{ param: "ipv4", kulcs: "halozat", sugo: "A célhálózat címe" }, { param: "ipv4", kulcs: "maszk", sugo: "A célhálózat maszkja" }];
      l.push({ modok: ["konfig"], szavak: [...eleje, ...cel, KOVETKEZO4], vegrehajt: (ctx, e) => ipRoute(ctx, e, torol) });
      l.push({ modok: ["konfig"], szavak: [...eleje, ...cel, KIMENO], vegrehajt: (ctx, e) => ipRoute(ctx, e, torol) });
      l.push({ modok: ["konfig"], szavak: [...eleje, ...cel, KIMENO, { ...KOVETKEZO4, sugo: "A következő ugrás címe (a kimenő interfészen)" }], vegrehajt: (ctx, e) => ipRoute(ctx, e, torol) });
      const eleje6 = torol ? [SZO.no, IPV6, ROUTE] : [IPV6, ROUTE];
      const pr = { param: "ipv6-prefix", kulcs: "pr", sugo: "A célhálózat (előtag/hossz, pl. ::/0)" };
      const kov6 = { param: "ipv6", kulcs: "kovetkezo", sugo: "A következő ugrás IPv6-címe" };
      l.push({ modok: ["konfig"], szavak: [...eleje6, pr, kov6], vegrehajt: (ctx, e) => ipv6Route(ctx, e, torol) });
      l.push({ modok: ["konfig"], szavak: [...eleje6, pr, KIMENO], vegrehajt: (ctx, e) => ipv6Route(ctx, e, torol) });
      l.push({ modok: ["konfig"], szavak: [...eleje6, pr, KIMENO, kov6], vegrehajt: (ctx, e) => ipv6Route(ctx, e, torol) });
    }
    return l;
  }
  var RR = ["konfig-router"];
  var ripParancsok = [
    {
      modok: ["konfig"],
      szavak: [ROUTER, RIP],
      vegrehajt(ctx) {
        if (!ctx.eszkoz.rip) ctx.eszkoz.rip = ujRip();
        ctx.modValt("konfig-router", { protokoll: "rip" });
        valtozott(ctx, { csalad: 4 });
      }
    },
    {
      modok: ["konfig"],
      szavak: [SZO.no, ROUTER, RIP],
      vegrehajt(ctx) {
        ctx.eszkoz.rip = null;
        valtozott(ctx, { csalad: 4 });
      }
    },
    {
      modok: RR,
      szavak: [{ szo: "version", sugo: "A RIP verziója" }, { param: "szam", kulcs: "v", min: 1, max: 2, nev: "<1-2>", sugo: "Verziószám (1 vagy 2)" }],
      vegrehajt(ctx, { v }) {
        ctx.eszkoz.rip.verzio = v;
        valtozott(ctx, { keres: true, csalad: 4 });
      }
    },
    {
      modok: RR,
      szavak: [SZO.no, { szo: "version", sugo: "Vissza az alapértékre (v1-et küld, v1-et és v2-t fogad)" }],
      vegrehajt(ctx) {
        ctx.eszkoz.rip.verzio = null;
        valtozott(ctx, { csalad: 4 });
      }
    },
    {
      modok: RR,
      szavak: [
        { szo: "network", sugo: "Hálózat felvétele: ezeken az interfészeken fut a RIP, és ezeket hirdeti" },
        { param: "ipv4", kulcs: "cim", sugo: "Hálózatcím (osztályos hálózatként tárolódik)" }
      ],
      vegrehajt(ctx, { cim }) {
        const n = osztalyos(ipSzam(cim));
        const szoveg = ipSzoveg(n.halozat);
        const rip = ctx.eszkoz.rip;
        if (!rip.halozatok.includes(szoveg)) {
          rip.halozatok.push(szoveg);
          rip.halozatok.sort((a, b) => ipSzam(a) - ipSzam(b));
        }
        valtozott(ctx, { keres: true, csalad: 4 });
      }
    },
    {
      modok: RR,
      szavak: [SZO.no, { szo: "network", sugo: "Hálózat törlése a RIP-ből" }, { param: "ipv4", kulcs: "cim", sugo: "Hálózatcím" }],
      vegrehajt(ctx, { cim }) {
        const szoveg = ipSzoveg(osztalyos(ipSzam(cim)).halozat);
        const rip = ctx.eszkoz.rip;
        if (!rip.halozatok.includes(szoveg)) {
          ctx.kiir(`%RIP: Network ${szoveg} not configured`);
          return;
        }
        rip.halozatok = rip.halozatok.filter((x) => x !== szoveg);
        valtozott(ctx, { csalad: 4 });
      }
    },
    {
      modok: RR,
      szavak: [
        { szo: "passive-interface", sugo: "Ezen az interfészen nem küld frissítést (a hálózatát továbbra is hirdeti)" },
        { param: "interfesz", kulcs: "interfesz", sugo: "Az interfész neve" }
      ],
      vegrehajt(ctx, { interfesz }) {
        const rip = ctx.eszkoz.rip;
        if (!routerPort(ctx.eszkoz, interfesz)) return;
        if (!rip.passziv.includes(interfesz)) rip.passziv.push(interfesz);
        valtozott(ctx, { csalad: 4 });
      }
    },
    {
      modok: RR,
      szavak: [
        SZO.no,
        { szo: "passive-interface", sugo: "Az interfész ismét küld frissítést" },
        { param: "interfesz", kulcs: "interfesz", sugo: "Az interfész neve" }
      ],
      vegrehajt(ctx, { interfesz }) {
        const rip = ctx.eszkoz.rip;
        rip.passziv = rip.passziv.filter((x) => x !== interfesz);
        valtozott(ctx, { keres: true, csalad: 4 });
      }
    },
    {
      modok: RR,
      szavak: [{ szo: "auto-summary", sugo: "Automatikus összegzés az osztályhatáron (gyárilag bekapcsolva)" }],
      vegrehajt(ctx) {
        ctx.eszkoz.rip.autoSummary = true;
        valtozott(ctx, { csalad: 4 });
      }
    },
    {
      modok: RR,
      szavak: [SZO.no, { szo: "auto-summary", sugo: "Az automatikus összegzés kikapcsolása: az alhálózatok maszkkal együtt mennek ki" }],
      vegrehajt(ctx) {
        ctx.eszkoz.rip.autoSummary = false;
        valtozott(ctx, { csalad: 4 });
      }
    },
    {
      modok: RR,
      szavak: [{ szo: "default-information", sugo: "Alapértelmezett útvonal hirdetése" }, { szo: "originate", sugo: "A 0.0.0.0/0 hirdetése a többi routernek" }],
      vegrehajt(ctx) {
        ctx.eszkoz.rip.alapUtvonal = true;
        valtozott(ctx, { csalad: 4 });
      }
    },
    {
      modok: RR,
      szavak: [SZO.no, { szo: "default-information", sugo: "Az alapértelmezett útvonal hirdetésének kikapcsolása" }, { szo: "originate", sugo: "A 0.0.0.0/0 hirdetése" }],
      vegrehajt(ctx) {
        ctx.eszkoz.rip.alapUtvonal = false;
        valtozott(ctx, { csalad: 4 });
      }
    },
    {
      modok: RR,
      szavak: [
        { szo: "timers", sugo: "A RIP időzítői" },
        { szo: "basic", sugo: "Frissítés, invalid, holddown, flush (másodpercben)" },
        { param: "szam", kulcs: "u", min: 1, max: 4294967, nev: "<1-4294967>", sugo: "Frissítési időköz (alapból 30)" },
        { param: "szam", kulcs: "i", min: 1, max: 4294967, nev: "<1-4294967>", sugo: "Ennyi idő után érvénytelen az útvonal (alapból 180)" },
        { param: "szam", kulcs: "hd", min: 0, max: 4294967, nev: "<0-4294967>", sugo: "Visszatartás – holddown (alapból 180)" },
        { param: "szam", kulcs: "fl", min: 1, max: 4294967, nev: "<1-4294967>", sugo: "Ennyi idő után törlődik az útvonal (alapból 240)" }
      ],
      vegrehajt(ctx, { u, i, hd, fl }) {
        ctx.eszkoz.rip.idozitok = { frissites: u, ervenytelen: i, visszatartas: hd, torles: fl };
      }
    },
    {
      modok: RR,
      szavak: [SZO.no, { szo: "timers", sugo: "Az időzítők visszaállítása" }, { szo: "basic", sugo: "Az alapértékek: 30, 180, 180, 240" }],
      vegrehajt(ctx) {
        ctx.eszkoz.rip.idozitok = ujRip().idozitok;
      }
    },
    // IPv6
    {
      modok: ["konfig"],
      szavak: [IPV6, { szo: "unicast-routing", sugo: "IPv6-csomagok továbbítása (gyárilag kikapcsolva)" }],
      vegrehajt(ctx) {
        ctx.eszkoz.ipv6Routing = true;
        valtozott(ctx, { keres: true, csalad: 6 });
      }
    },
    {
      modok: ["konfig"],
      szavak: [SZO.no, IPV6, { szo: "unicast-routing", sugo: "Az IPv6-továbbítás kikapcsolása" }],
      vegrehajt(ctx) {
        ctx.eszkoz.ipv6Routing = false;
        valtozott(ctx, { csalad: 6 });
      }
    },
    {
      modok: ["konfig"],
      szavak: [IPV6, ROUTER, { szo: "rip", sugo: "RIPng (RIP IPv6-hoz)" }, { param: "szo", kulcs: "nev", nev: "WORD", sugo: "A folyamat neve (csak ezen a routeren számít)" }],
      vegrehajt(ctx, { nev }) {
        if (!ctx.eszkoz.ipv6Routing) {
          ctx.kiir("% IPv6 routing not enabled");
          return;
        }
        if (!ctx.eszkoz.ripng[nev]) ctx.eszkoz.ripng[nev] = {};
        ctx.modValt("konfig-rtr", { ripng: nev });
        valtozott(ctx, { csalad: 6 });
      }
    },
    {
      modok: ["konfig"],
      szavak: [SZO.no, IPV6, ROUTER, { szo: "rip", sugo: "RIPng-folyamat törlése" }, { param: "szo", kulcs: "nev", nev: "WORD", sugo: "A folyamat neve" }],
      vegrehajt(ctx, { nev }) {
        delete ctx.eszkoz.ripng[nev];
        for (const p of ctx.eszkoz.portok) {
          if (p.ripng === nev) {
            p.ripng = "";
            p.ripngAlap = "";
          }
        }
        valtozott(ctx, { csalad: 6 });
      }
    }
  ];
  var routerKonfigParancsok = [...interfeszParancsokR, ...utvonalParancsok(), ...ripParancsok];

  // src/gyartok/ios/kimenetek/ospf.js
  function most3(r) {
    return r.halozat ? r.halozat.ora.ido : 0;
  }
  function hms(ms) {
    const s = Math.max(0, Math.ceil(ms / 1e3));
    const p = (x) => String(x).padStart(2, "0");
    return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
  }
  function hmsEzred(ms) {
    const e = Math.max(0, Math.floor(ms));
    const s = Math.floor(e / 1e3);
    const p = (x) => String(x).padStart(2, "0");
    return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}.${String(e % 1e3).padStart(3, "0")}`;
  }
  function rovid2(nev) {
    return nev.replace(/^GigabitEthernet/, "Gi").replace(/^Serial/, "Se").replace(/^Loopback/, "Lo");
  }
  function fejlec(r, csalad) {
    const o = ospfBeall(r, csalad);
    const a = ospfAllapot(r, csalad);
    return csalad === 4 ? `            OSPF Router with ID (${a.rid}) (Process ID ${o.folyamat})` : `          OSPFv3 Router with ID (${a.rid}) (Process ID ${o.folyamat})`;
  }
  function fut(r, csalad) {
    return !!ospfBeall(r, csalad) && ospfAllapot(r, csalad).fut;
  }
  var ALLAPOT_ROVID = { BROADCAST: "", POINT_TO_POINT: "P2P", LOOPBACK: "LOOP" };
  function ifAllapotRovid(I) {
    if (I.allapot === "DROTHER") return "DROTH";
    if (I.allapot === "WAITING") return "WAIT";
    return ALLAPOT_ROVID[I.tipus] || I.allapot;
  }
  function showOspfNeighbor(r, csalad) {
    if (!fut(r, csalad)) return [];
    const a = ospfAllapot(r, csalad);
    const s = csalad === 4 ? ["", "Neighbor ID     Pri   State           Dead Time   Address         Interface"] : ["", fejlec(r, 6), "", "Neighbor ID     Pri   State           Dead Time   Interface ID    Interface"];
    const ifek = [...a.ifek].reverse();
    for (const I of ifek) {
      for (const n of I.szomszedok) {
        const szerep = szomszedSzerep(I, n);
        const allapot3 = `${n.allapot}/${szerep === "-" ? "  -" : szerep}`;
        const dead = hms(n.deadLejar - most3(r));
        const kozep = csalad === 4 ? n.cim.padEnd(16) : String(n.ifId).padEnd(16);
        s.push(`${n.rid.padEnd(15)}${String(n.prioritas).padStart(4)}   ${allapot3.padEnd(16)}${dead.padEnd(12)}${kozep}${I.port}`);
      }
    }
    if (csalad === 6) s.push("");
    return s;
  }
  function showOspfIntBrief(r, csalad) {
    if (!fut(r, csalad)) return [];
    const o = ospfBeall(r, csalad);
    const a = ospfAllapot(r, csalad);
    const s = [csalad === 4 ? "Interface    PID   Area            IP Address/Mask    Cost  State Nbrs F/C" : "Interface    PID   Area            Intf ID    Cost  State Nbrs F/C"];
    for (const I of [...a.ifek].reverse()) {
      const p = r.portok.find((x) => x.nev === I.port);
      const teljes = I.szomszedok.filter((n) => n.allapot === "FULL").length;
      const kozep = csalad === 4 ? `${p.ip}/${prefixHossz(p.maszk)}`.padEnd(19) : String(interfeszAzon(r, p)).padEnd(11);
      s.push(`${rovid2(p.nev).padEnd(13)}${String(o.folyamat).padEnd(6)}${String(I.terulet).padEnd(16)}${kozep}${String(koltseg(r, p, csalad)).padEnd(6)}${ifAllapotRovid(I).padEnd(6)}${teljes}/${I.szomszedok.length}`);
    }
    return s;
  }
  function ifReszletek(r, csalad, p) {
    const o = ospfBeall(r, csalad);
    const a = ospfAllapot(r, csalad);
    const I = a.ifek.find((x) => x.port === p.nev);
    const fejSor = `${p.nev} is ${p.leallitva ? "administratively down" : portFent(p) ? "up" : "down"}, line protocol is ${portFent(p) ? "up" : "down"}`;
    const t = ospfTerulet(r, p, csalad);
    if (!t) return [fejSor, `  ${csalad === 4 ? "OSPF" : "OSPFv3"} not enabled on this interface`];
    if (!I) {
      return [
        fejSor,
        csalad === 4 ? `  Internet Address ${p.ip}/${prefixHossz(p.maszk)}, Area ${t.terulet}` : `  Area ${t.terulet}, Process ID ${o.folyamat}`,
        `  Process ID ${o.folyamat}, Router ID ${a.rid || "0.0.0.0"}, Network Type ${I ? I.tipus : "BROADCAST"}, Cost: ${koltseg(r, p, csalad)}`,
        "  Interface is down"
      ];
    }
    const s = [fejSor];
    const tip = I.tipus;
    if (csalad === 4) {
      s.push(`  Internet Address ${p.ip}/${prefixHossz(p.maszk)}, Area ${I.terulet}, Attached via ${t.mod === "network" ? "Network Statement" : "Interface Enable"}`);
      s.push(`  Process ID ${o.folyamat}, Router ID ${a.rid}, Network Type ${tip}, Cost: ${koltseg(r, p, csalad)}`);
    } else {
      s.push(`  Link Local Address ${ipv6Szoveg(portLinkLocal(p))}, Interface ID ${interfeszAzon(r, p)}`);
      s.push(`  Area ${I.terulet}, Process ID ${o.folyamat}, Instance ID 0, Router ID ${a.rid}`);
      s.push(`  Network Type ${tip}, Cost: ${koltseg(r, p, csalad)}`);
    }
    if (tip === "LOOPBACK") {
      s.push(`  Loopback interface is treated as a stub Host`);
      return s;
    }
    const allapotNev = I.allapot === "P2P" ? "POINT_TO_POINT" : I.allapot;
    s.push(`  Transmit Delay is 1 sec, State ${allapotNev}${tip === "BROADCAST" ? `, Priority ${(csalad === 4 ? p.ospf : p.ospf6).prioritas}` : ""}`);
    if (tip === "BROADCAST") {
      if (I.dr) s.push(csalad === 4 ? `  Designated Router (ID) ${I.dr.rid}, Interface address ${I.dr.cim}` : `  Designated Router (ID) ${I.dr.rid}, local address ${I.dr.cim}`);
      else s.push("  No designated router on this network");
      if (I.bdr) s.push(csalad === 4 ? `  Backup Designated router (ID) ${I.bdr.rid}, Interface address ${I.bdr.cim}` : `  Backup Designated router (ID) ${I.bdr.rid}, local address ${I.bdr.cim}`);
      else s.push("  No backup designated router on this network");
    }
    s.push(`  Timer intervals configured, Hello ${I.idok.hello}, Dead ${I.idok.dead}, Wait ${I.idok.dead}, Retransmit 5`);
    if (I.passziv) s.push("    No Hellos (Passive interface)");
    else s.push(`    Hello due in ${hms(I.kovHello - most3(r))}`);
    if (csalad === 4) {
      const h = p.ospf.hitelesites;
      if (h === "md5") {
        const ids = Object.keys(p.ospf.kulcsok).map(Number).sort((x, y) => y - x);
        s.push("  Cryptographic authentication enabled");
        s.push(ids.length ? `    Youngest key id is ${ids[0]}` : "    No key configured, using default key id 0");
      } else if (h === "egyszeru") {
        s.push("  Simple password authentication enabled");
      }
    }
    const teljes = I.szomszedok.filter((n) => n.allapot === "FULL");
    s.push(`  Neighbor Count is ${I.szomszedok.length}, Adjacent neighbor count is ${teljes.length}`);
    for (const n of teljes) {
      const sz = szomszedSzerep(I, n);
      const megj = sz === "DR" ? "  (Designated Router)" : sz === "BDR" ? "  (Backup Designated Router)" : "";
      s.push(`    Adjacent with neighbor ${n.rid}${megj}`);
    }
    s.push("  Suppress hello for 0 neighbor(s)");
    return s;
  }
  function showOspfInterface(r, csalad, nev = null) {
    if (!ospfBeall(r, csalad)) return [];
    if (nev) {
      const p = r.portok.find((x) => x.nev === nev);
      return p ? ifReszletek(r, csalad, p) : [];
    }
    if (!fut(r, csalad)) return [];
    const a = ospfAllapot(r, csalad);
    const s = [];
    for (const I of a.ifek) s.push(...ifReszletek(r, csalad, r.portok.find((x) => x.nev === I.port)));
    return s;
  }
  function seq(n) {
    return `0x${(n >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
  }
  function showOspfDatabase(r, csalad) {
    if (!fut(r, csalad)) return [];
    const db = ospfAdatbazis(r, csalad);
    const s = ["", fejlec(r, csalad)];
    const kor2 = (l) => String(lsaKor(r, l)).padEnd(12);
    if (csalad === 4) {
      for (const { terulet, lsak } of db.teruletek) {
        const rt = lsak.filter((l) => l.tipus === "router").sort((x, y) => ipSzam(x.lsId) - ipSzam(y.lsId));
        const nt = lsak.filter((l) => l.tipus === "network").sort((x, y) => ipSzam(x.lsId) - ipSzam(y.lsId));
        s.push("", `                Router Link States (Area ${terulet})`, "", "Link ID         ADV Router      Age         Seq#       Checksum Link count");
        for (const l of rt) s.push(`${l.lsId.padEnd(16)}${l.adv.padEnd(16)}${kor2(l)}${seq(l.sorszam)} ${lsaOsszeg(l)} ${l.torzs.linkek.length}`);
        if (nt.length) {
          s.push("", `                Net Link States (Area ${terulet})`, "", "Link ID         ADV Router      Age         Seq#       Checksum");
          for (const l of nt) s.push(`${l.lsId.padEnd(16)}${l.adv.padEnd(16)}${kor2(l)}${seq(l.sorszam)} ${lsaOsszeg(l)}`);
        }
      }
      if (db.kulso.length) {
        s.push("", "                Type-5 AS External Link States", "", "Link ID         ADV Router      Age         Seq#       Checksum Tag");
        for (const l of db.kulso) s.push(`${l.lsId.padEnd(16)}${l.adv.padEnd(16)}${kor2(l)}${seq(l.sorszam)} ${lsaOsszeg(l)} ${l.torzs.tag}`);
      }
      s.push("");
      return s;
    }
    const kor6 = (l) => String(lsaKor(r, l)).padEnd(12);
    const rendez = (x, y) => ipSzam(x.adv) - ipSzam(y.adv) || Number(x.lsId) - Number(y.lsId);
    for (const { terulet, lsak } of db.teruletek) {
      const rt = lsak.filter((l) => l.tipus === "router").sort(rendez);
      const nt = lsak.filter((l) => l.tipus === "network").sort(rendez);
      const lt = lsak.filter((l) => l.tipus === "link").sort(rendez);
      const pt = lsak.filter((l) => l.tipus === "prefix").sort(rendez);
      s.push("", `                Router Link States (Area ${terulet})`, "", "ADV Router       Age         Seq#        Fragment ID  Link count  Bits");
      for (const l of rt) {
        s.push(`${l.adv.padEnd(17)}${kor6(l)}${seq(l.sorszam).padEnd(12)}${"0".padEnd(13)}${String(l.torzs.linkek.length).padEnd(12)}${l.torzs.asbr ? "E" : "None"}`);
      }
      if (nt.length) {
        s.push("", `                Net Link States (Area ${terulet})`, "", "ADV Router       Age         Seq#        Link ID    Rtr count");
        for (const l of nt) s.push(`${l.adv.padEnd(17)}${kor6(l)}${seq(l.sorszam).padEnd(12)}${l.lsId.padEnd(11)}${l.torzs.routerek.length}`);
      }
      if (lt.length) {
        s.push("", `                Link (Type-8) Link States (Area ${terulet})`, "", "ADV Router       Age         Seq#        Link ID    Interface");
        for (const l of lt) s.push(`${l.adv.padEnd(17)}${kor6(l)}${seq(l.sorszam).padEnd(12)}${l.lsId.padEnd(11)}${rovid2(l.link || "")}`);
      }
      if (pt.length) {
        s.push("", `                Intra Area Prefix Link States (Area ${terulet})`, "", "ADV Router       Age         Seq#        Link ID    Ref-lstype  Ref-LSID");
        for (const l of pt) {
          s.push(`${l.adv.padEnd(17)}${kor6(l)}${seq(l.sorszam).padEnd(12)}${l.lsId.padEnd(11)}${(l.torzs.ref === "router" ? "0x2001" : "0x2002").padEnd(12)}${l.torzs.refId}`);
        }
      }
    }
    if (db.kulso.length) {
      s.push("", "                Type-5 AS External Link States", "", "ADV Router       Age         Seq#        Prefix");
      for (const l of db.kulso) s.push(`${l.adv.padEnd(17)}${kor6(l)}${seq(l.sorszam).padEnd(12)}${l.torzs.prefix}`);
    }
    s.push("");
    return s;
  }
  function showOspf(r, csalad) {
    if (!fut(r, csalad)) return [];
    const o = ospfBeall(r, csalad);
    const a = ospfAllapot(r, csalad);
    const db = ospfAdatbazis(r, csalad);
    const s = [csalad === 4 ? ` Routing Process "ospf ${o.folyamat}" with ID ${a.rid}` : ` Routing Process "ospfv3 ${o.folyamat}" with ID ${a.rid}`];
    s.push(` Start time: ${hmsEzred(a.indulas)}, Time elapsed: ${hmsEzred(most3(r) - a.indulas)}`);
    if (csalad === 4) s.push(" Supports only single TOS(TOS0) routes");
    const asbr = db.kulso.some((l) => l.adv === a.rid);
    if (asbr) s.push(" It is an autonomous system boundary router", " Redistributing External Routes from,");
    s.push(` Number of external LSA ${db.kulso.length}`);
    const teruletek = [...new Set(a.ifek.map((I) => I.terulet))].sort((x, y) => x - y);
    s.push(` Number of areas in this router is ${teruletek.length}. ${teruletek.length} normal 0 stub 0 nssa`);
    s.push(` Reference bandwidth unit is ${o.referencia} mbps`);
    for (const T of teruletek) {
      const lsak = (db.teruletek.find((x) => x.terulet === T) || { lsak: [] }).lsak;
      const ifSzam = a.ifek.filter((I) => I.terulet === T).length;
      s.push(`    Area ${T === 0 ? "BACKBONE(0)" : T}`);
      s.push(`        Number of interfaces in this area is ${ifSzam}`);
      if (csalad === 4) {
        const md5 = r.portok.some((p) => a.ifek.some((I) => I.port === p.nev && I.terulet === T) && p.ospf.hitelesites === "md5");
        s.push(md5 ? "        Area has no authentication (interface-level authentication is configured)" : "        Area has no authentication");
      }
      if (a.spfIdo !== null) s.push(`        SPF algorithm last executed ${hmsEzred(most3(r) - a.spfIdo)} ago`);
      s.push(`        SPF algorithm executed ${a.spfSzam} times`);
      s.push(`        Number of LSA ${lsak.length}`);
    }
    s.push("");
    return s;
  }
  function ipProtocolsOspf(r) {
    const o = r.ospf;
    if (!o) return [];
    const a = ospfAllapot(r, 4);
    const db = ospfAdatbazis(r, 4);
    const s = [
      `Routing Protocol is "ospf ${o.folyamat}"`,
      "  Outgoing update filter list for all interfaces is not set",
      "  Incoming update filter list for all interfaces is not set",
      `  Router ID ${a.fut ? a.rid : o.routerId || "0.0.0.0"}`
    ];
    if (db.kulso.some((l) => l.adv === a.rid)) s.push("  It is an autonomous system boundary router", " Redistributing External Routes from,");
    const teruletek = [...new Set(a.ifek.map((I) => I.terulet))];
    const n = Math.max(teruletek.length, o.halozatok.length ? 1 : 0);
    s.push(`  Number of areas in this router is ${n}. ${n} normal 0 stub 0 nssa`);
    s.push(`  Maximum path: ${o.maxUtak}`);
    s.push("  Routing for Networks:");
    for (const h of o.halozatok) s.push(`    ${h.cim} ${h.wildcard} area ${h.terulet}`);
    const expl = r.portok.filter((p) => p.ospf.folyamat === o.folyamat && p.ospf.terulet !== null);
    const expT = [...new Set(expl.map((p) => p.ospf.terulet))].sort((x, y) => x - y);
    for (const T of expT) {
      s.push(`  Routing on Interfaces Configured Explicitly (Area ${T}):`);
      for (const p of expl.filter((x) => x.ospf.terulet === T)) s.push(`    ${p.nev}`);
    }
    const passz = r.portok.filter((p) => passzivE(r, p, 4));
    if (passz.length) {
      s.push("  Passive Interface(s):");
      for (const p of passz) s.push(`    ${p.nev}`);
    }
    s.push("  Routing Information Sources:", "    Gateway         Distance      Last Update");
    const forrasok = [];
    for (const { lsak } of db.teruletek) for (const l of lsak) if (l.tipus === "router" && l.adv !== a.rid) forrasok.push(l);
    forrasok.sort((x, y) => ipSzam(x.adv) - ipSzam(y.adv));
    for (const l of forrasok) s.push(`    ${l.adv.padEnd(15)}${"110".padStart(9)}      ${hms(most3(r) - l.ido)}`);
    s.push("  Distance: (default is 110)", "");
    return s;
  }
  function ipv6ProtocolsOspf(r) {
    const o = r.ospf6;
    if (!o) return [];
    const a = ospfAllapot(r, 6);
    const db = ospfAdatbazis(r, 6);
    const s = [`IPv6 Routing Protocol is "ospf ${o.folyamat}"`, `  Router ID ${a.fut ? a.rid : o.routerId || "0.0.0.0"}`];
    if (db.kulso.some((l) => l.adv === a.rid)) s.push("  Autonomous system boundary router");
    const teruletek = [...new Set(a.ifek.map((I) => I.terulet))].sort((x, y) => x - y);
    s.push(`  Number of areas: ${teruletek.length} normal, 0 stub, 0 nssa`);
    for (const T of teruletek) {
      s.push(`  Interfaces (Area ${T}):`);
      for (const I of a.ifek.filter((x) => x.terulet === T)) s.push(`    ${I.port}`);
    }
    s.push("  Redistribution:", "    None");
    return s;
  }

  // src/gyartok/ios/kimenetek/router.js
  function kor(ms) {
    const s = Math.max(0, Math.floor(ms / 1e3));
    const p = (x) => String(x).padStart(2, "0");
    return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
  }
  function most4(r) {
    return r.halozat ? r.halozat.ora.ido : 0;
  }
  function allapotSzoveg(p) {
    if (p.leallitva) return "administratively down";
    return portFent(p) ? "up" : "down";
  }
  function showIpIntBrief(r) {
    const s = ["Interface              IP-Address      OK? Method Status                Protocol"];
    for (const p of r.portok) {
      const ip = p.ip || "unassigned";
      const mod = p.ip ? "manual" : "unset ";
      const allapot3 = allapotSzoveg(p);
      const proto = portFent(p) ? "up" : "down";
      s.push(`${p.nev.padEnd(23)}${ip.padEnd(16)}YES ${mod.padEnd(7)}${allapot3.padEnd(22)}${proto}`.trimEnd());
    }
    return s;
  }
  function showIpv6IntBrief(r) {
    const s = [];
    for (const p of r.portok) {
      s.push(`${p.nev.padEnd(23)}[${allapotSzoveg(p)}/${portFent(p) ? "up" : "down"}]`);
      if (!ipv6Engedelyezve(p)) {
        s.push("    unassigned");
        continue;
      }
      s.push(`    ${ipv6Szoveg(portLinkLocal(p))}`);
      for (const c of p.ipv6) s.push(`    ${c.cim}`);
    }
    return s;
  }
  var KODOK4 = [
    "Codes: L - local, C - connected, S - static, R - RIP, O - OSPF, D - EIGRP",
    "       E1 - OSPF external type 1, E2 - OSPF external type 2",
    "       * - candidate default"
  ];
  function utSorok(r, e, eleje) {
    if (e.kod === "C" || e.kod === "L") return [`${eleje} is directly connected, ${e.utak[0].port}`];
    if (e.lehetLe) {
      const u = e.utak[0];
      return [`${eleje} is possibly down, routing via ${ipSzoveg(u.kovetkezo)}, ${u.port}`];
    }
    const sorok = [];
    e.utak.forEach((u, i) => {
      let resz;
      if (e.kod === "S" && u.kovetkezo === null) resz = `is directly connected, ${u.port}`;
      else {
        resz = `[${e.ad}/${e.metrika}] via ${ipSzoveg(u.kovetkezo)}`;
        if (e.kod === "R" || e.kod === "O") resz += `, ${kor(most4(r) - u.ido)}`;
        if (u.port) resz += `, ${u.port}`;
      }
      if (i === 0) sorok.push(`${eleje} ${resz}`);
      else sorok.push(`${" ".repeat(eleje.length + 1)}${resz}`);
    });
    return sorok;
  }
  function showIpRoute(r, szuro = null) {
    const s = [...KODOK4, ""];
    const gw = utolsoMenedek4(r);
    if (gw && !szuro) {
      const u = gw.utak[0];
      s.push(`Gateway of last resort is ${u.kovetkezo !== null ? ipSzoveg(u.kovetkezo) : "0.0.0.0"} to network 0.0.0.0`);
    } else if (!szuro) {
      s.push("Gateway of last resort is not set");
    } else if (gw) {
      s.push(`Gateway of last resort is ${gw.utak[0].kovetkezo !== null ? ipSzoveg(gw.utak[0].kovetkezo) : "0.0.0.0"} to network 0.0.0.0`);
    } else {
      s.push("Gateway of last resort is not set");
    }
    s.push("");
    const teljes = tabla4(r);
    const kell = (e) => !szuro || szuro === "rip" && e.kod === "R" || szuro === "static" && e.kod === "S" || szuro === "ospf" && e.kod === "O" || szuro === "connected" && (e.kod === "C" || e.kod === "L");
    const csoportok = /* @__PURE__ */ new Map();
    for (const e of teljes) {
      const o = e.hossz === 0 ? { halozat: 0, hossz: 0 } : osztalyos(e.halozat);
      const k = `${o.halozat}/${o.hossz}`;
      if (!csoportok.has(k)) csoportok.set(k, { o, elemek: [] });
      csoportok.get(k).elemek.push(e);
    }
    const kod = (e) => `${e.kod}${e.alap ? "*" : ""}${e.alKod || ""}`;
    for (const { o, elemek } of [...csoportok.values()].sort((a, b) => a.o.halozat - b.o.halozat)) {
      const latszik = elemek.filter(kell);
      if (!latszik.length) continue;
      if (o.hossz === 0 || elemek.length === 1 && elemek[0].hossz === o.hossz) {
        for (const e of latszik) s.push(...utSorok(r, e, `${kod(e).padEnd(6)}${ipSzoveg(e.halozat)}/${e.hossz}`));
        continue;
      }
      const maszkok = new Set(elemek.map((e) => e.hossz));
      if (maszkok.size === 1) {
        const h = elemek[0].hossz;
        s.push(`      ${ipSzoveg(o.halozat)}/${h} is subnetted, ${elemek.length} subnets`);
        for (const e of latszik) s.push(...utSorok(r, e, `${kod(e).padEnd(9)}${ipSzoveg(e.halozat)}`));
      } else {
        s.push(`      ${ipSzoveg(o.halozat)}/${o.hossz} is variably subnetted, ${elemek.length} subnets, ${maszkok.size} masks`);
        for (const e of latszik) s.push(...utSorok(r, e, `${kod(e).padEnd(9)}${ipSzoveg(e.halozat)}/${e.hossz}`));
      }
    }
    return s;
  }
  function showIpv6Route(r, szuro = null) {
    const t = tabla6(r);
    const kell = (e) => !szuro || szuro === "rip" && e.kod === "R" || szuro === "static" && e.kod === "S" || szuro === "ospf" && e.kod === "O" || szuro === "connected" && (e.kod === "C" || e.kod === "L");
    const latszik = t.filter(kell);
    const null0 = !szuro || szuro === "connected";
    const s = [
      `IPv6 Routing Table - default - ${t.length + 1} entries`,
      "Codes: C - Connected, L - Local, S - Static, R - RIP, O - OSPF Intra, D - EIGRP",
      "       OE1 - OSPF ext 1, OE2 - OSPF ext 2",
      ""
    ];
    for (const e of latszik) {
      const cim = `${ipv6Szoveg(e.halozat)}/${e.hossz}`;
      if (e.lehetLe) {
        s.push(`${e.kod.padEnd(4)}${cim} [${e.ad}/16]`, `     via ${ipv6Szoveg(e.utak[0].kovetkezo)}, ${e.utak[0].port}`);
        continue;
      }
      s.push(`${(e.kod + (e.alKod || "")).padEnd(4)}${cim} [${e.ad}/${e.metrika}]${e.alKod ? ", tag 1" : ""}`);
      for (const u of e.utak) {
        if (e.kod === "C") s.push(`     via ${u.port}, directly connected`);
        else if (e.kod === "L") s.push(`     via ${u.port}, receive`);
        else if (!u.kovetkezo) s.push(`     via ${u.port}, directly connected`);
        else s.push(`     via ${ipv6Szoveg(u.kovetkezo)}${u.port ? `, ${u.port}` : ""}`);
      }
    }
    if (null0) s.push("L   FF00::/8 [0/0]", "     via Null0, receive");
    return s;
  }
  function showIpProtocols(r) {
    const s = ["*** IP Routing is NSF aware ***", ""];
    s.push(...ipProtocolsOspf(r));
    const rip = r.rip;
    if (!rip) return s;
    const t = rip.idozitok;
    const kov = ripKovetkezo(r, 4);
    s.push(
      'Routing Protocol is "rip"',
      "  Outgoing update filter list for all interfaces is not set",
      "  Incoming update filter list for all interfaces is not set",
      `  Sending updates every ${t.frissites} seconds${kov !== null ? `, next due in ${kov} seconds` : ""}`,
      `  Invalid after ${t.ervenytelen} seconds, hold down ${t.visszatartas}, flushed after ${t.torles}`,
      "  Redistributing: rip"
    );
    const kuld3 = rip.verzio === 2 ? "2" : "1";
    const fogad = rip.verzio === 2 ? "2" : rip.verzio === 1 ? "1" : "1 2";
    const fogadSzoveg = rip.verzio ? `receive version ${rip.verzio}` : "receive any version";
    s.push(`  Default version control: send version ${kuld3}, ${fogadSzoveg}`);
    s.push("    Interface                           Send  Recv  Triggered RIP  Key-chain");
    for (const p of ripPortok(r, 4)) {
      if (rip.passziv.includes(p.nev)) continue;
      s.push(`    ${p.nev.padEnd(36)}${kuld3.padEnd(6)}${fogad.padEnd(6)}     No        none`);
    }
    s.push(`  Automatic network summarization is ${rip.autoSummary ? "" : "not "}in effect`);
    s.push("  Maximum path: 4", "  Routing for Networks:");
    for (const n of rip.halozatok) s.push(`    ${n}`);
    if (rip.passziv.length) {
      s.push("  Passive Interface(s):");
      for (const p of rip.passziv) s.push(`    ${p}`);
    }
    s.push("  Routing Information Sources:", "    Gateway         Distance      Last Update");
    for (const f of ripForrasok(r, 4).sort((a, b) => ipSzam(a.cim) - ipSzam(b.cim))) {
      s.push(`    ${f.cim.padEnd(15)}${"120".padStart(9)}      ${kor(most4(r) - f.ido)}`);
    }
    s.push("  Distance: (default is 120)", "");
    return s;
  }
  function showIpv6Protocols(r) {
    const s = ['IPv6 Routing Protocol is "connected"', 'IPv6 Routing Protocol is "application"', 'IPv6 Routing Protocol is "ND"'];
    if (r.statikus6.length) s.push('IPv6 Routing Protocol is "static"');
    s.push(...ipv6ProtocolsOspf(r));
    for (const nev of Object.keys(r.ripng)) {
      s.push(`IPv6 Routing Protocol is "rip ${nev}"`, "  Interfaces:");
      for (const p of r.portok) if (p.ripng === nev) s.push(`    ${p.nev}`);
      s.push("  Redistribution:", "    None");
    }
    s.push("");
    return s;
  }
  function showIpRipDatabase(r) {
    if (!r.rip) return [];
    const db = ripAdatbazis(r, 4);
    const sorok = [];
    for (const c of db.kapcsolt) sorok.push({ h: c.halozat, l: c.hossz, s: [`${ipSzoveg(c.halozat)}/${c.hossz}    directly connected, ${c.port}`] });
    for (const e of db.tanult) {
      if (db.kapcsolt.some((c) => c.halozat === e.halozat && c.hossz === e.hossz)) continue;
      const fej = `${ipSzoveg(e.halozat)}/${e.hossz}`;
      if (e.le) {
        sorok.push({ h: e.halozat, l: e.hossz, s: [`${fej}    is possibly down`] });
        continue;
      }
      sorok.push({ h: e.halozat, l: e.hossz, s: [fej, ...e.utak.map((u) => `    [${e.metrika}] via ${ipSzoveg(u.kovetkezo)}, ${kor(most4(r) - u.ido)}, ${u.port}`)] });
    }
    if (r.rip.autoSummary) {
      const fok = /* @__PURE__ */ new Map();
      for (const x of sorok) {
        if (x.l === 0) continue;
        const o = osztalyos(x.h);
        if (o.hossz < x.l) fok.set(o.halozat, o);
      }
      for (const o of fok.values()) sorok.push({ h: o.halozat, l: o.hossz - 0.5, s: [`${ipSzoveg(o.halozat)}/${o.hossz}    auto-summary`] });
    }
    if (r.rip.alapUtvonal) sorok.push({ h: 0, l: -0.5, s: ["0.0.0.0/0    auto-summary"] });
    sorok.sort((a, b) => a.h - b.h || a.l - b.l);
    return sorok.flatMap((x) => x.s);
  }
  function showIpv6Rip(r) {
    const s = [];
    let pid = 290;
    for (const nev of Object.keys(r.ripng)) {
      const sz = ripSzamlalok(r, 6);
      const alap = r.portok.some((p) => p.ripng === nev && p.ripngAlap);
      const t = RIPNG_IDOZITOK;
      s.push(
        `RIP process "${nev}", port 521, multicast-group FF02::9, pid ${pid++}`,
        "     Administrative distance is 120. Maximum paths is 16",
        `     Updates every ${t.frissites} seconds, expire after ${t.ervenytelen}`,
        `     Holddown lasts ${t.visszatartas} seconds, garbage collect after ${t.torles}`,
        "     Split horizon is on; poison reverse is off",
        `     Default routes are ${alap ? "" : "not "}generated`,
        `     Periodic updates ${sz.periodikus}, trigger updates ${sz.valtozasra}`,
        "     Full Advertisement 0, Delayed Events 0",
        "  Interfaces:"
      );
      for (const p of r.portok) if (p.ripng === nev) s.push(`    ${p.nev}`);
      s.push("  Redistribution:", "    None");
    }
    if (!s.length) s.push("");
    return s;
  }
  function showIpv6RipDatabase(r) {
    const s = [];
    const rib = new Map(tabla6(r).map((e) => [`${ipv6Szoveg(e.halozat)}/${e.hossz}`, e.kod]));
    for (const nev of Object.keys(r.ripng)) {
      s.push(`RIP process "${nev}", local RIB`);
      if (!r.ipv6Routing) continue;
      for (const e of ripAdatbazis(r, 6).tanult) {
        const k = `${ipv6Szoveg(e.halozat)}/${e.hossz}`;
        if (e.le) {
          s.push(` ${k}, metric 16, expired`);
          continue;
        }
        s.push(` ${k}, metric ${e.metrika}${rib.get(k) === "R" ? ", installed" : ""}`);
        for (const u of e.utak) {
          const lejar = Math.max(0, Math.ceil((u.ido + RIPNG_IDOZITOK.ervenytelen * 1e3 - most4(r)) / 1e3));
          s.push(`     ${u.port}/${ipv6Szoveg(u.kovetkezo)}, expires in ${lejar} secs`);
        }
      }
    }
    return s;
  }
  function showIpArp(r) {
    const s = ["Protocol  Address          Age (min)  Hardware Addr   Type   Interface"];
    const sorok = [];
    for (const p of r.portok) {
      if (p.ip && portFent(p) && p.tipus === "GigabitEthernet") sorok.push([p.ip, "-", p.mac, p.nev]);
    }
    for (const [ip, b] of Object.entries(r.arpTabla)) {
      const port2 = r.portok.find((p) => p.nev === b.port);
      if (port2 && port2.tipus === "GigabitEthernet") sorok.push([ip, String(Math.floor((most4(r) - b.ido) / 6e4)), b.mac, b.port]);
    }
    sorok.sort((a, b) => ipSzam(a[0]) - ipSzam(b[0]));
    for (const [ip, kor_, mac, port2] of sorok) {
      s.push(`Internet  ${ip.padEnd(17)}${kor_.padStart(9)}   ${macPontos(mac)}  ARPA   ${port2}`);
    }
    return s;
  }
  function routerKonfiguracio(r) {
    const s = [
      "!",
      "version 16.9",
      "service timestamps debug datetime msec",
      "service timestamps log datetime msec",
      "platform qfp utilization monitor load 80",
      "no platform punt-keepalive disable-kernel-core",
      "!",
      `hostname ${r.hostname}`,
      "!",
      "boot-start-marker",
      "boot-end-marker",
      "!",
      "!",
      "no aaa new-model",
      "!"
    ];
    if (r.ipv6Routing) s.push("ipv6 unicast-routing");
    s.push("!", "!", "!", "!");
    for (const p of r.portok) {
      s.push(`interface ${p.nev}`);
      if (p.leiras) s.push(` description ${p.leiras}`);
      if (p.savszel) s.push(` bandwidth ${p.savszel}`);
      s.push(p.ip ? ` ip address ${p.ip} ${p.maszk}` : " no ip address");
      if (p.mtu) s.push(` ip mtu ${p.mtu}`);
      s.push(...ospfInterfeszSorok(p.ospf, "ip"));
      if (p.leallitva) s.push(" shutdown");
      if (p.tipus === "GigabitEthernet") s.push(" negotiation auto");
      if (p.tipus === "Serial" && p.orajel) s.push(` clock rate ${p.orajel}`);
      if (p.linkLocal) s.push(` ipv6 address ${p.linkLocal} link-local`);
      for (const c of p.ipv6) s.push(` ipv6 address ${c.cim}/${c.hossz}`);
      if (p.ipv6Be) s.push(" ipv6 enable");
      if (p.mtu6) s.push(` ipv6 mtu ${p.mtu6}`);
      s.push(...ospfInterfeszSorok(p.ospf6, "ipv6"));
      if (p.ripng) {
        s.push(` ipv6 rip ${p.ripng} enable`);
        if (p.ripngAlap) s.push(` ipv6 rip ${p.ripng} default-information ${p.ripngAlap}`);
      }
      s.push("!");
    }
    if (r.ospf) s.push(...ospfFolyamatSorok(r.ospf, "router ospf"));
    if (r.rip) {
      const rip = r.rip;
      s.push("router rip");
      if (rip.verzio) s.push(` version ${rip.verzio}`);
      const t = rip.idozitok;
      if (t.frissites !== 30 || t.ervenytelen !== 180 || t.visszatartas !== 180 || t.torles !== 240) {
        s.push(` timers basic ${t.frissites} ${t.ervenytelen} ${t.visszatartas} ${t.torles}`);
      }
      for (const p of rip.passziv) s.push(` passive-interface ${p}`);
      for (const n of rip.halozatok) s.push(` network ${n}`);
      if (rip.alapUtvonal) s.push(" default-information originate");
      if (!rip.autoSummary) s.push(" no auto-summary");
      s.push("!");
    }
    s.push("ip forward-protocol nd", "no ip http server", "ip http secure-server");
    for (const st of r.statikus) {
      s.push(`ip route ${st.halozat} ${st.maszk}${st.interfesz ? ` ${st.interfesz}` : ""}${st.kovetkezo ? ` ${st.kovetkezo}` : ""}`);
    }
    s.push("!");
    for (const st of r.statikus6) {
      s.push(`ipv6 route ${st.prefix}${st.interfesz ? ` ${st.interfesz}` : ""}${st.kovetkezo ? ` ${st.kovetkezo}` : ""}`);
    }
    for (const nev of Object.keys(r.ripng)) s.push(`ipv6 router rip ${nev}`);
    if (r.ospf6) s.push(...ospfFolyamatSorok(r.ospf6, "ipv6 router ospf"));
    s.push(
      "!",
      "!",
      "!",
      "control-plane",
      "!",
      "!",
      "line con 0",
      " transport input none",
      " stopbits 1",
      "line aux 0",
      " stopbits 1",
      "line vty 0 4",
      " login",
      "!",
      "!",
      "end"
    );
    return s;
  }
  function ospfInterfeszSorok(o, elo) {
    const s = [];
    if (elo === "ip") {
      if (o.hitelesites === "md5") s.push(" ip ospf authentication message-digest");
      else if (o.hitelesites === "egyszeru") s.push(" ip ospf authentication");
      else if (o.hitelesites === "null") s.push(" ip ospf authentication null");
      if (o.jelszo) s.push(` ip ospf authentication-key ${o.jelszo}`);
      for (const k of Object.keys(o.kulcsok).map(Number).sort((a, b) => a - b)) s.push(` ip ospf message-digest-key ${k} md5 ${o.kulcsok[k]}`);
    }
    if (o.halozatTipus) s.push(` ${elo} ospf network ${o.halozatTipus}`);
    if (o.hello) s.push(` ${elo} ospf hello-interval ${o.hello}`);
    if (o.dead) s.push(` ${elo} ospf dead-interval ${o.dead}`);
    if (o.prioritas !== 1) s.push(` ${elo} ospf priority ${o.prioritas}`);
    if (o.folyamat !== null) s.push(` ${elo} ospf ${o.folyamat} area ${o.terulet}`);
    if (o.koltseg) s.push(` ${elo} ospf cost ${o.koltseg}`);
    return s;
  }
  function ospfFolyamatSorok(o, fej) {
    const s = [`${fej} ${o.folyamat}`];
    if (o.routerId) s.push(` router-id ${o.routerId}`);
    if (o.referencia !== 100) s.push(` auto-cost reference-bandwidth ${o.referencia}`);
    if (o.passzivAlap) {
      s.push(" passive-interface default");
      for (const p of o.nemPassziv) s.push(` no passive-interface ${p}`);
    } else {
      for (const p of o.passziv) s.push(` passive-interface ${p}`);
    }
    for (const n of o.halozatok || []) s.push(` network ${n.cim} ${n.wildcard} area ${n.terulet}`);
    if (o.alapUtvonal) s.push(` default-information originate${o.alapUtvonal === "always" ? " always" : ""}`);
    if (o.maxUtak !== 4) s.push(` maximum-paths ${o.maxUtak}`);
    s.push("!");
    return s;
  }
  function showRunningConfigRouter(r) {
    const torzs = routerKonfiguracio(r);
    const bajt = torzs.reduce((o, sor2) => o + sor2.length + 1, 0);
    return ["Building configuration...", "", `Current configuration : ${bajt} bytes`, ...torzs, ""];
  }

  // src/gyartok/ios/parancsok/router-exec.js
  var EXEC2 = ["felhasznalo", "priv"];
  var SHOW2 = { szo: "show", sugo: "Információk megjelenítése az eszközről" };
  var IP2 = { szo: "ip", sugo: "IPv4-információk" };
  var IPV62 = { szo: "ipv6", sugo: "IPv6-információk" };
  var ROUTE2 = { szo: "route", sugo: "A routing tábla (melyik hálózat merre érhető el)" };
  var RIP2 = { szo: "rip", sugo: "Csak a RIP-ből tanult útvonalak" };
  var INTERFACE = { szo: "interface", sugo: "Az interfészek IP-beállításai" };
  var BRIEF = { szo: "brief", sugo: "Rövid összefoglaló: interfészenként cím és állapot" };
  var PROTOCOLS = { szo: "protocols", sugo: "A futó forgalomirányító protokollok és beállításaik" };
  var DATABASE = { szo: "database", sugo: "A RIP adatbázisa (minden tanult útvonal)" };
  function lista(modok, szavak, fn, lapozhato = true) {
    return { modok, szavak, lapozhato, vegrehajt: (ctx, e) => ctx.kiir(...fn(ctx.eszkoz, e)) };
  }
  var szurok = [
    [null, null],
    ["rip", RIP2],
    ["connected", { szo: "connected", sugo: "Csak a közvetlenül kapcsolt hálózatok" }],
    ["static", { szo: "static", sugo: "Csak a statikus útvonalak" }],
    ["ospf", { szo: "ospf", sugo: "Csak az OSPF-ből tanult útvonalak" }]
  ];
  var showParancsok2 = [
    lista(["priv"], [SHOW2, { szo: "running-config", sugo: "Az éppen futó (érvényes) konfiguráció" }], (r) => showRunningConfigRouter(r)),
    lista(EXEC2, [SHOW2, IP2, INTERFACE, BRIEF], (r) => showIpIntBrief(r)),
    lista(EXEC2, [SHOW2, IPV62, INTERFACE, BRIEF], (r) => showIpv6IntBrief(r)),
    ...szurok.map(([sz, szo]) => lista(EXEC2, [SHOW2, IP2, ROUTE2, ...szo ? [szo] : []], (r) => showIpRoute(r, sz))),
    ...szurok.map(([sz, szo]) => lista(EXEC2, [SHOW2, IPV62, ROUTE2, ...szo ? [szo] : []], (r) => showIpv6Route(r, sz))),
    lista(EXEC2, [SHOW2, IP2, PROTOCOLS], (r) => showIpProtocols(r)),
    lista(EXEC2, [SHOW2, IPV62, PROTOCOLS], (r) => showIpv6Protocols(r)),
    lista(EXEC2, [SHOW2, IP2, { szo: "rip", sugo: "RIP-információk" }, DATABASE], (r) => showIpRipDatabase(r)),
    lista(EXEC2, [SHOW2, IPV62, { szo: "rip", sugo: "RIPng-folyamatok és beállításaik" }], (r) => showIpv6Rip(r)),
    lista(EXEC2, [SHOW2, IPV62, { szo: "rip", sugo: "RIPng-információk" }, { szo: "database", sugo: "A RIPng adatbázisa" }], (r) => showIpv6RipDatabase(r)),
    lista(EXEC2, [SHOW2, IP2, { szo: "arp", sugo: "Az ARP-tábla: IP-cím → MAC-cím" }], (r) => showIpArp(r))
  ];
  function pingFolyamat(r, cel, forras) {
    return {
      folyamat: (kiir, kesz, hozzafuz) => {
        let jelek = "";
        const fuz = (j) => {
          jelek += j;
          if (hozzafuz) hozzafuz(j);
        };
        const idok = [];
        let i = 0;
        const egy = () => {
          if (i >= 5 || !r.halozat) return vege();
          i++;
          routerPing(r.halozat, r, cel, (e) => {
            if (e.fajta === "valasz") {
              idok.push(Math.max(1, e.keses || 0));
              fuz("!");
            } else if (e.fajta === "elerhetetlen") fuz("U");
            else if (e.fajta === "ido-lejart") fuz("&");
            else fuz(".");
            r.halozat.ora.utemez(e.fajta === "elerhetetlen" ? 300 : 1, egy);
          }, { forras });
        };
        const vege = () => {
          if (!hozzafuz) kiir(jelek.padEnd(5, "."));
          const db = idok.length;
          let sor2 = `Success rate is ${Math.round(db / 5 * 100)} percent (${db}/5)`;
          if (db) {
            const min = Math.min(...idok);
            const max = Math.max(...idok);
            const atl = Math.round(idok.reduce((a, b) => a + b, 0) / db);
            sor2 += `, round-trip min/avg/max = ${min}/${atl}/${max} ms`;
          }
          kiir(sor2);
          kesz();
        };
        egy();
      }
    };
  }
  function ping(ctx, { cim, forrasIf, forrasCim }) {
    const r = ctx.eszkoz;
    const v6 = cim.includes(":");
    const cel = v6 ? ipv6Normal(cim) : cim;
    let forras = null;
    if (forrasIf) {
      const p = r.portok.find((x) => x.nev === forrasIf);
      forras = p && (v6 ? portForras6(p) : p.ip);
      if (!forras) {
        ctx.kiir(`% Invalid source interface - ${v6 ? "IPv6" : "IP"} not enabled`);
        return;
      }
    } else if (forrasCim) {
      forras = forrasCim.includes(":") ? ipv6Normal(forrasCim) : forrasCim;
      const sajat = v6 ? r.portok.some((p) => p.ipv6.some((x) => x.cim === forras)) : r.portok.some((p) => p.ip === forras);
      if (!sajat) {
        ctx.kiir(`% Invalid source address- ${forras} is not a local address`);
        return;
      }
    }
    const sorok = ["Type escape sequence to abort.", `Sending 5, 100-byte ICMP Echos to ${cel}, timeout is 2 seconds:`];
    if (forras) sorok.push(`Packet sent with a source address of ${forras}`);
    ctx.kiir(...sorok, pingFolyamat(r, cel, forras));
  }
  var TRACE_TURELEM = 5;
  function traceFolyamat(r, cel) {
    return {
      folyamat: (kiir, kesz) => {
        let ttl = 1;
        let ures = 0;
        const ugras = () => {
          if (!r.halozat || ttl > 30) return kesz();
          const valaszok = [];
          let proba = 0;
          const egy = () => {
            proba++;
            routerPing(r.halozat, r, cel, (e) => {
              valaszok.push(e);
              if (proba < 3) return r.halozat.ora.utemez(1, egy);
              return sorKesz();
            }, { ttl, varakozas: 3e3 });
          };
          const sorKesz = () => {
            let sor2 = `  ${ttl}`;
            let elozo = null;
            let celba = false;
            for (const v of valaszok) {
              if (v.fajta === "idotullepes") {
                sor2 += " *";
                continue;
              }
              if (v.kitol !== elozo) {
                sor2 += ` ${v.kitol}`;
                elozo = v.kitol;
              }
              if (v.fajta === "elerhetetlen") {
                sor2 += " !N";
                celba = true;
              } else {
                sor2 += ` ${Math.max(1, v.keses || 0)} msec`;
                if (v.fajta === "valasz") celba = true;
              }
            }
            kiir(sor2);
            ures = valaszok.every((v) => v.fajta === "idotullepes") ? ures + 1 : 0;
            if (celba) return kesz();
            if (ures >= TRACE_TURELEM) {
              kiir("[Szimulátor] Több ugrás óta nem jön válasz – a valódi eszköz 30 ugrásig próbálkozna (megszakítás: Ctrl+Shift+6).");
              return kesz();
            }
            ttl++;
            ugras();
          };
          egy();
        };
        ugras();
      }
    };
  }
  function traceroute(ctx, { cim }) {
    const cel = cim.includes(":") ? ipv6Normal(cim) : cim;
    ctx.kiir("Type escape sequence to abort.", `Tracing the route to ${cel}`, "VRF info: (vrf in name/id, vrf out name/id)", traceFolyamat(ctx.eszkoz, cel));
  }
  var CIM4 = { param: "ipv4", kulcs: "cim", sugo: "A cél IPv4-címe" };
  var CIM6 = { param: "ipv6", kulcs: "cim", sugo: "A cél IPv6-címe" };
  var PING = { szo: "ping", sugo: "Elérhető-e egy cím (ICMP echo)" };
  var FORRAS = { szo: "source", sugo: "A ping forráscíme (pl. a LAN-interfészé – így a visszautat is próbálja)" };
  var TRACE = { szo: "traceroute", sugo: "Merre jutnak el a csomagok a célig (ugrásonként)" };
  var DEBUG = { szo: "debug", sugo: "Hibakereső üzenetek bekapcsolása" };
  var UNDEBUG = { szo: "undebug", sugo: "Hibakereső üzenetek kikapcsolása" };
  var RIP_D = { szo: "rip", sugo: "A RIP üzenetei (küldött és fogadott frissítések)" };
  function debugAll(ctx, mit, be) {
    ctx.eszkoz.debug[mit] = be;
    const nev = mit === "rip" ? "RIP protocol debugging" : "RIP Routing Protocol debugging";
    ctx.kiir(`${nev} is ${be ? "on" : "off"}`);
  }
  function mindKi(ctx) {
    for (const k of Object.keys(ctx.eszkoz.debug)) ctx.eszkoz.debug[k] = false;
    ctx.kiir("All possible debugging has been turned off");
  }
  var egyebParancsok = [
    { modok: EXEC2, szavak: [PING, CIM4], vegrehajt: ping },
    { modok: EXEC2, szavak: [PING, CIM6], vegrehajt: ping },
    ...[CIM4, CIM6].flatMap((cim) => [
      { modok: EXEC2, szavak: [PING, cim, FORRAS, { param: "interfesz", kulcs: "forrasIf", sugo: "Erről az interfészről (annak címével) induljon" }], vegrehajt: ping },
      { modok: EXEC2, szavak: [PING, cim, FORRAS, { param: cim === CIM4 ? "ipv4" : "ipv6", kulcs: "forrasCim", sugo: "Ezzel a (saját) forráscímmel induljon" }], vegrehajt: ping }
    ]),
    { modok: EXEC2, szavak: [TRACE, CIM4], vegrehajt: traceroute },
    { modok: EXEC2, szavak: [TRACE, CIM6], vegrehajt: traceroute },
    { modok: ["priv"], szavak: [DEBUG, { szo: "ip", sugo: "IPv4-es hibakeresés" }, RIP_D], vegrehajt: (ctx) => debugAll(ctx, "rip", true) },
    { modok: ["priv"], szavak: [DEBUG, { szo: "ipv6", sugo: "IPv6-os hibakeresés" }, { szo: "rip", sugo: "A RIPng üzenetei" }], vegrehajt: (ctx) => debugAll(ctx, "ripng", true) },
    { modok: ["priv"], szavak: [UNDEBUG, { szo: "ip", sugo: "IPv4-es hibakeresés" }, RIP_D], vegrehajt: (ctx) => debugAll(ctx, "rip", false) },
    { modok: ["priv"], szavak: [UNDEBUG, { szo: "ipv6", sugo: "IPv6-os hibakeresés" }, { szo: "rip", sugo: "A RIPng üzenetei" }], vegrehajt: (ctx) => debugAll(ctx, "ripng", false) },
    { modok: ["priv"], szavak: [UNDEBUG, { szo: "all", sugo: "Minden hibakereső üzenet kikapcsolása" }], vegrehajt: mindKi },
    { modok: ["priv"], szavak: [SZO.no, { szo: "debug", sugo: "Hibakereső üzenetek kikapcsolása" }, { szo: "all", sugo: "Mindegyiket" }], vegrehajt: mindKi },
    { modok: ["priv"], szavak: [SZO.no, { szo: "debug", sugo: "Hibakereső üzenetek kikapcsolása" }, { szo: "ip", sugo: "IPv4-es hibakeresés" }, RIP_D], vegrehajt: (ctx) => debugAll(ctx, "rip", false) },
    {
      modok: ["priv"],
      szavak: [
        { szo: "clear", sugo: "Törlés (táblák, számlálók)" },
        { szo: "ip", sugo: "IPv4-táblák" },
        { szo: "route", sugo: "A routing tábla" },
        { szo: "*", sugo: "Minden tanult útvonal törlése (a RIP újra megkérdezi a szomszédokat)" }
      ],
      vegrehajt(ctx) {
        ripTorol(ctx.eszkoz);
      }
    }
  ];
  var routerExecParancsok = [...showParancsok2, ...egyebParancsok];

  // src/gyartok/ios/parancsok/ospf.js
  var IF_MODOK4 = ["konfig-if", "konfig-if-tartomany"];
  var MINDKET_MOD = ["konfig-ospf", "konfig-ospf6"];
  var IP3 = { szo: "ip", sugo: "IPv4-beállítások" };
  var IPV63 = { szo: "ipv6", sugo: "IPv6-beállítások" };
  var OSPF = { szo: "ospf", sugo: "OSPF-beállítások ezen az interfészen" };
  var ROUTER2 = { szo: "router", sugo: "Forgalomirányító protokoll indítása / beállítása" };
  var FOLYAMAT = { param: "szam", kulcs: "id", min: 1, max: 65535, nev: "<1-65535>", sugo: "A folyamat azonosítója (csak ezen a routeren számít)" };
  var AREA = { szo: "area", sugo: "A terület (area), amelybe az interfész kerül" };
  var TERULET = { param: "terulet", kulcs: "terulet", sugo: "A terület azonosítója" };
  function csaladja(ctx) {
    return ctx.mod === "konfig-ospf6" ? 6 : 4;
  }
  function beall(ctx) {
    return csaladja(ctx) === 4 ? ctx.eszkoz.ospf : ctx.eszkoz.ospf6;
  }
  function portjai2(ctx) {
    return ctx.kontextus.portok.map((n) => routerPort(ctx.eszkoz, n)).filter(Boolean);
  }
  function valtozott2(ctx, csalad) {
    ospfValtozott(ctx.eszkoz, csalad ? { csalad } : {});
    if (ctx.eszkoz.halozat) ctx.eszkoz.halozat.esemeny({ tipus: "allapot" });
  }
  function egyFolyamat(ctx, regi, uj) {
    ctx.kiir(`[Szimulátor] Egy routeren egyszerre csak egy OSPF-folyamat futhat (most a(z) ${regi}-es). Ha másikat szeretnél, előbb töröld: no router ospf ${regi} (ezt a(z) ${uj}-es helyett írd be).`);
  }
  var folyamatParancsok = [
    {
      modok: ["konfig"],
      szavak: [ROUTER2, { szo: "ospf", sugo: "OSPF (Open Shortest Path First)" }, FOLYAMAT],
      vegrehajt(ctx, { id }) {
        const r = ctx.eszkoz;
        if (r.ospf && r.ospf.folyamat !== id) return egyFolyamat(ctx, r.ospf.folyamat, id);
        if (!r.ospf) r.ospf = ujOspf(id);
        ctx.modValt("konfig-ospf", { ospf: id });
        valtozott2(ctx, 4);
        return void 0;
      }
    },
    {
      modok: ["konfig"],
      szavak: [SZO.no, ROUTER2, { szo: "ospf", sugo: "Az OSPF-folyamat törlése" }, FOLYAMAT],
      vegrehajt(ctx, { id }) {
        const r = ctx.eszkoz;
        if (!r.ospf || r.ospf.folyamat !== id) return;
        r.ospf = null;
        for (const p of r.portok) if (p.ospf.folyamat === id) Object.assign(p.ospf, { folyamat: null, terulet: null });
        valtozott2(ctx, 4);
      }
    },
    {
      modok: ["konfig"],
      szavak: [IPV63, ROUTER2, { szo: "ospf", sugo: "OSPFv3 (OSPF IPv6-hoz)" }, FOLYAMAT],
      vegrehajt(ctx, { id }) {
        const r = ctx.eszkoz;
        if (!r.ipv6Routing) {
          ctx.kiir("% IPv6 routing not enabled");
          return void 0;
        }
        if (r.ospf6 && r.ospf6.folyamat !== id) return egyFolyamat(ctx, r.ospf6.folyamat, id);
        if (!r.ospf6) r.ospf6 = ujOspf(id);
        ctx.modValt("konfig-ospf6", { ospf6: id });
        valtozott2(ctx, 6);
        return void 0;
      }
    },
    {
      modok: ["konfig"],
      szavak: [SZO.no, IPV63, ROUTER2, { szo: "ospf", sugo: "Az OSPFv3-folyamat törlése" }, FOLYAMAT],
      vegrehajt(ctx, { id }) {
        const r = ctx.eszkoz;
        if (!r.ospf6 || r.ospf6.folyamat !== id) return;
        r.ospf6 = null;
        for (const p of r.portok) if (p.ospf6.folyamat === id) Object.assign(p.ospf6, { folyamat: null, terulet: null });
        valtozott2(ctx, 6);
      }
    }
  ];
  function ujrainditasKell(ctx) {
    const c = csaladja(ctx);
    ctx.kiir(c === 4 ? '% OSPF: Reload or use "clear ip ospf process" command, for this to take effect' : '% OSPFv3: Reload or use "clear ipv6 ospf process" command, for this to take effect');
  }
  var almodParancsok = [
    {
      modok: MINDKET_MOD,
      szavak: [{ szo: "router-id", sugo: "A router azonosítója (router ID) kézzel" }, { param: "ipv4", kulcs: "rid", sugo: "Router ID IP-cím alakban, pl. 1.1.1.1" }],
      vegrehajt(ctx, { rid }) {
        const o = beall(ctx);
        if (rid === "0.0.0.0") {
          ctx.kiir("% OSPF: Invalid router-id");
          return;
        }
        if (o.routerId === rid) return;
        o.routerId = rid;
        if (ospfVanSzomszed(ctx.eszkoz, csaladja(ctx))) ujrainditasKell(ctx);
        valtozott2(ctx, csaladja(ctx));
      }
    },
    {
      modok: MINDKET_MOD,
      szavak: [SZO.no, { szo: "router-id", sugo: "Vissza az automatikus router ID-ra" }],
      vegrehajt(ctx) {
        const o = beall(ctx);
        if (!o.routerId) return;
        o.routerId = "";
        if (ospfVanSzomszed(ctx.eszkoz, csaladja(ctx))) ujrainditasKell(ctx);
        valtozott2(ctx, csaladja(ctx));
      }
    },
    {
      modok: ["konfig-ospf"],
      szavak: [
        { szo: "network", sugo: "Ezeken az interfészeken fusson az OSPF (cím + wildcard maszk + terület)" },
        { param: "ipv4", kulcs: "cim", sugo: "Hálózatcím (vagy az interfész címe)" },
        { param: "ipv4", kulcs: "wc", sugo: "Wildcard maszk (0 = egyeznie kell, 1 = bármi lehet), pl. 0.0.0.255" },
        AREA,
        TERULET
      ],
      vegrehajt(ctx, { cim, wc, terulet }) {
        const o = ctx.eszkoz.ospf;
        const n = ipSzoveg((ipSzam(cim) & ~ipSzam(wc)) >>> 0);
        const regi = o.halozatok.find((x) => x.cim === n && x.wildcard === wc);
        if (regi) {
          if (regi.terulet !== terulet) ctx.kiir(`% OSPF: "network ${n} ${wc}" is already configured in area ${regi.terulet}`);
          return;
        }
        o.halozatok.push({ cim: n, wildcard: wc, terulet });
        valtozott2(ctx, 4);
      }
    },
    {
      modok: ["konfig-ospf"],
      szavak: [
        SZO.no,
        { szo: "network", sugo: "Egy network parancs törlése" },
        { param: "ipv4", kulcs: "cim", sugo: "Hálózatcím" },
        { param: "ipv4", kulcs: "wc", sugo: "Wildcard maszk" },
        AREA,
        TERULET
      ],
      vegrehajt(ctx, { cim, wc, terulet }) {
        const o = ctx.eszkoz.ospf;
        const n = ipSzoveg((ipSzam(cim) & ~ipSzam(wc)) >>> 0);
        const elotte = o.halozatok.length;
        o.halozatok = o.halozatok.filter((x) => !(x.cim === n && x.wildcard === wc && x.terulet === terulet));
        if (o.halozatok.length === elotte) ctx.kiir("% OSPF: Specified network not found");
        valtozott2(ctx, 4);
      }
    },
    {
      modok: MINDKET_MOD,
      szavak: [
        { szo: "passive-interface", sugo: "Ezen az interfészen nincs Hello (a hálózatát továbbra is hirdeti)" },
        { param: "interfesz", kulcs: "interfesz", sugo: "Az interfész neve" }
      ],
      vegrehajt(ctx, { interfesz }) {
        const o = beall(ctx);
        if (!routerPort(ctx.eszkoz, interfesz)) return;
        if (o.passzivAlap) o.nemPassziv = o.nemPassziv.filter((x) => x !== interfesz);
        else if (!o.passziv.includes(interfesz)) o.passziv.push(interfesz);
        valtozott2(ctx, csaladja(ctx));
      }
    },
    {
      modok: MINDKET_MOD,
      szavak: [
        SZO.no,
        { szo: "passive-interface", sugo: "Az interfész ismét küld Hellót" },
        { param: "interfesz", kulcs: "interfesz", sugo: "Az interfész neve" }
      ],
      vegrehajt(ctx, { interfesz }) {
        const o = beall(ctx);
        if (o.passzivAlap) {
          if (!o.nemPassziv.includes(interfesz)) o.nemPassziv.push(interfesz);
        } else {
          o.passziv = o.passziv.filter((x) => x !== interfesz);
        }
        valtozott2(ctx, csaladja(ctx));
      }
    },
    {
      modok: MINDKET_MOD,
      szavak: [
        { szo: "passive-interface", sugo: "Ezen az interfészen nincs Hello (a hálózatát továbbra is hirdeti)" },
        { szo: "default", sugo: "Minden interfész passzív (a kivételeket „no passive-interface …” jelöli)" }
      ],
      vegrehajt(ctx) {
        const o = beall(ctx);
        o.passzivAlap = true;
        o.nemPassziv = [];
        o.passziv = [];
        valtozott2(ctx, csaladja(ctx));
      }
    },
    {
      modok: MINDKET_MOD,
      szavak: [
        SZO.no,
        { szo: "passive-interface", sugo: "Az interfész ismét küld Hellót" },
        { szo: "default", sugo: "Alapból egyik interfész se legyen passzív" }
      ],
      vegrehajt(ctx) {
        const o = beall(ctx);
        o.passzivAlap = false;
        o.nemPassziv = [];
        o.passziv = [];
        valtozott2(ctx, csaladja(ctx));
      }
    },
    {
      modok: MINDKET_MOD,
      szavak: [
        { szo: "auto-cost", sugo: "A költség számítása a sávszélességből" },
        { szo: "reference-bandwidth", sugo: "A referencia-sávszélesség (ennyi Mbit/s-os link költsége 1)" },
        { param: "szam", kulcs: "mbps", min: 1, max: 4294967, nev: "<1-4294967>", sugo: "Mbit/s-ban (alapból 100)" }
      ],
      vegrehajt(ctx, { mbps }) {
        beall(ctx).referencia = mbps;
        ctx.kiir(`% ${csaladja(ctx) === 4 ? "OSPF" : "OSPFv3"}: Reference bandwidth is changed.`, "        Please ensure reference bandwidth is consistent across all routers.");
        valtozott2(ctx, csaladja(ctx));
      }
    },
    {
      modok: MINDKET_MOD,
      szavak: [
        SZO.no,
        { szo: "auto-cost", sugo: "A költség számítása a sávszélességből" },
        { szo: "reference-bandwidth", sugo: "Vissza az alapértékre (100 Mbit/s)" }
      ],
      vegrehajt(ctx) {
        beall(ctx).referencia = 100;
        ctx.kiir(`% ${csaladja(ctx) === 4 ? "OSPF" : "OSPFv3"}: Reference bandwidth is changed.`, "        Please ensure reference bandwidth is consistent across all routers.");
        valtozott2(ctx, csaladja(ctx));
      }
    },
    ...[false, true].map((always) => ({
      modok: MINDKET_MOD,
      szavak: [
        { szo: "default-information", sugo: "Alapértelmezett útvonal hirdetése" },
        { szo: "originate", sugo: "Az alapértelmezett útvonal hirdetése (ha a routernek van ilyen)" },
        ...always ? [{ szo: "always", sugo: "Akkor is hirdesse, ha a routernek nincs alapértelmezett útvonala" }] : []
      ],
      vegrehajt(ctx) {
        beall(ctx).alapUtvonal = always ? "always" : "originate";
        valtozott2(ctx, csaladja(ctx));
      }
    })),
    {
      modok: MINDKET_MOD,
      szavak: [
        SZO.no,
        { szo: "default-information", sugo: "Az alapértelmezett útvonal hirdetésének kikapcsolása" },
        { szo: "originate", sugo: "Az alapértelmezett útvonal hirdetése" }
      ],
      vegrehajt(ctx) {
        beall(ctx).alapUtvonal = "";
        valtozott2(ctx, csaladja(ctx));
      }
    },
    {
      modok: MINDKET_MOD,
      szavak: [
        { szo: "maximum-paths", sugo: "Legfeljebb ennyi egyenlő költségű utat használ" },
        { param: "szam", kulcs: "n", min: 1, max: 32, nev: "<1-32>", sugo: "Az utak száma (alapból 4)" }
      ],
      vegrehajt(ctx, { n }) {
        beall(ctx).maxUtak = n;
        valtozott2(ctx, csaladja(ctx));
      }
    },
    {
      modok: MINDKET_MOD,
      szavak: [SZO.no, { szo: "maximum-paths", sugo: "Vissza az alapértékre (4)" }],
      vegrehajt(ctx) {
        beall(ctx).maxUtak = 4;
        valtozott2(ctx, csaladja(ctx));
      }
    }
  ];
  function kozosInterfesz(csalad) {
    const ELO = csalad === 4 ? [IP3, OSPF] : [IPV63, { ...OSPF, sugo: "OSPFv3-beállítások ezen az interfészen" }];
    const NO = [SZO.no, ...ELO];
    const pb = (p) => csalad === 4 ? p.ospf : p.ospf6;
    const allit = (mezo, ertek) => (ctx, e) => {
      for (const p of portjai2(ctx)) pb(p)[mezo] = typeof ertek === "function" ? ertek(e) : ertek;
      valtozott2(ctx, csalad);
    };
    return [
      {
        modok: IF_MODOK4,
        szavak: [...ELO, FOLYAMAT, AREA, TERULET],
        vegrehajt(ctx, { id, terulet }) {
          const r = ctx.eszkoz;
          if (csalad === 6 && !r.ipv6Routing) {
            ctx.kiir("% IPv6 routing not enabled");
            return void 0;
          }
          const o = csalad === 4 ? r.ospf : r.ospf6;
          if (o && o.folyamat !== id) return egyFolyamat(ctx, o.folyamat, id);
          if (!o) {
            if (csalad === 4) r.ospf = ujOspf(id);
            else r.ospf6 = ujOspf(id);
          }
          for (const p of portjai2(ctx)) Object.assign(pb(p), { folyamat: id, terulet });
          valtozott2(ctx, csalad);
          return void 0;
        }
      },
      {
        modok: IF_MODOK4,
        szavak: [...NO, FOLYAMAT, AREA, TERULET],
        vegrehajt(ctx, { id }) {
          for (const p of portjai2(ctx)) if (pb(p).folyamat === id) Object.assign(pb(p), { folyamat: null, terulet: null });
          valtozott2(ctx, csalad);
        }
      },
      {
        modok: IF_MODOK4,
        szavak: [
          ...ELO,
          { szo: "cost", sugo: "Az interfész költsége kézzel (felülírja a számoltat)" },
          { param: "szam", kulcs: "n", min: 1, max: 65535, nev: "<1-65535>", sugo: "Költség" }
        ],
        vegrehajt: allit("koltseg", (e) => e.n)
      },
      { modok: IF_MODOK4, szavak: [...NO, { szo: "cost", sugo: "Vissza a sávszélességből számolt költségre" }], vegrehajt: allit("koltseg", null) },
      {
        modok: IF_MODOK4,
        szavak: [
          ...ELO,
          { szo: "priority", sugo: "Prioritás a DR/BDR-választáshoz" },
          { param: "szam", kulcs: "n", min: 0, max: 255, nev: "<0-255>", sugo: "Prioritás (alapból 1; 0 = soha nem lesz DR/BDR)" }
        ],
        vegrehajt: allit("prioritas", (e) => e.n)
      },
      { modok: IF_MODOK4, szavak: [...NO, { szo: "priority", sugo: "Vissza az alapértékre (1)" }], vegrehajt: allit("prioritas", 1) },
      ...["point-to-point", "broadcast"].map((t) => ({
        modok: IF_MODOK4,
        szavak: [
          ...ELO,
          { szo: "network", sugo: "A hálózattípus kézi megadása" },
          t === "point-to-point" ? { szo: "point-to-point", sugo: "Pont-pont: két router, nincs DR/BDR-választás" } : { szo: "broadcast", sugo: "Többhozzáférésű (pl. Ethernet): DR/BDR-választással" }
        ],
        vegrehajt: allit("halozatTipus", t)
      })),
      { modok: IF_MODOK4, szavak: [...NO, { szo: "network", sugo: "Vissza az interfész alapértelmezett hálózattípusára" }], vegrehajt: allit("halozatTipus", "") },
      {
        modok: IF_MODOK4,
        szavak: [
          ...ELO,
          { szo: "hello-interval", sugo: "Ennyi másodpercenként küld Hellót (a szomszéddal egyeznie kell)" },
          { param: "szam", kulcs: "n", min: 1, max: 65535, nev: "<1-65535>", sugo: "Másodperc (alapból 10)" }
        ],
        vegrehajt: allit("hello", (e) => e.n)
      },
      { modok: IF_MODOK4, szavak: [...NO, { szo: "hello-interval", sugo: "Vissza az alapértékre (10 mp)" }], vegrehajt: allit("hello", null) },
      {
        modok: IF_MODOK4,
        szavak: [
          ...ELO,
          { szo: "dead-interval", sugo: "Ennyi másodperc Hello nélkül = a szomszéd halott (egyeznie kell)" },
          { param: "szam", kulcs: "n", min: 1, max: 65535, nev: "<1-65535>", sugo: "Másodperc (alapból a Hello négyszerese)" }
        ],
        vegrehajt: allit("dead", (e) => e.n)
      },
      { modok: IF_MODOK4, szavak: [...NO, { szo: "dead-interval", sugo: "Vissza az alapértékre (a Hello négyszerese)" }], vegrehajt: allit("dead", null) }
    ];
  }
  var hitelesitesParancsok = [
    ...[["", ""], ["message-digest", "md5"], ["null", "null"]].map(([szo, ertek]) => ({
      modok: IF_MODOK4,
      szavak: [
        IP3,
        OSPF,
        { szo: "authentication", sugo: "Hitelesítés ezen az interfészen" },
        ...szo === "message-digest" ? [{ szo: "message-digest", sugo: "MD5-hitelesítés (a kulcs: ip ospf message-digest-key)" }] : szo === "null" ? [{ szo: "null", sugo: "Nincs hitelesítés (felülírja a terület beállítását)" }] : []
      ],
      vegrehajt(ctx) {
        for (const p of portjai2(ctx)) p.ospf.hitelesites = ertek || "egyszeru";
        valtozott2(ctx, 4);
      }
    })),
    {
      modok: IF_MODOK4,
      szavak: [SZO.no, IP3, OSPF, { szo: "authentication", sugo: "A hitelesítés kikapcsolása" }],
      vegrehajt(ctx) {
        for (const p of portjai2(ctx)) p.ospf.hitelesites = "";
        valtozott2(ctx, 4);
      }
    },
    {
      modok: IF_MODOK4,
      szavak: [
        IP3,
        OSPF,
        { szo: "message-digest-key", sugo: "MD5-kulcs (a szomszéddal azonos számmal és jelszóval)" },
        { param: "szam", kulcs: "n", min: 1, max: 255, nev: "<1-255>", sugo: "A kulcs száma" },
        { szo: "md5", sugo: "MD5-algoritmus" },
        { param: "szo", kulcs: "jelszo", nev: "LINE", sugo: "A jelszó (legfeljebb 16 karakter)", maxHossz: 16 }
      ],
      vegrehajt(ctx, { n, jelszo }) {
        for (const p of portjai2(ctx)) {
          if (p.ospf.kulcsok[n] !== void 0 && p.ospf.kulcsok[n] !== jelszo) {
            ctx.kiir(`OSPF: Key ${n} already exists`);
            continue;
          }
          p.ospf.kulcsok[n] = jelszo;
        }
        valtozott2(ctx, 4);
      }
    },
    {
      modok: IF_MODOK4,
      szavak: [
        SZO.no,
        IP3,
        OSPF,
        { szo: "message-digest-key", sugo: "Egy MD5-kulcs törlése" },
        { param: "szam", kulcs: "n", min: 1, max: 255, nev: "<1-255>", sugo: "A kulcs száma" }
      ],
      vegrehajt(ctx, { n }) {
        for (const p of portjai2(ctx)) delete p.ospf.kulcsok[n];
        valtozott2(ctx, 4);
      }
    },
    {
      modok: IF_MODOK4,
      szavak: [
        IP3,
        OSPF,
        { szo: "authentication-key", sugo: "Egyszerű (titkosítatlan) jelszó" },
        { param: "szo", kulcs: "jelszo", nev: "LINE", sugo: "A jelszó (legfeljebb 8 karakter)", maxHossz: 8 }
      ],
      vegrehajt(ctx, { jelszo }) {
        for (const p of portjai2(ctx)) p.ospf.jelszo = jelszo;
        valtozott2(ctx, 4);
      }
    },
    {
      modok: IF_MODOK4,
      szavak: [SZO.no, IP3, OSPF, { szo: "authentication-key", sugo: "Az egyszerű jelszó törlése" }],
      vegrehajt(ctx) {
        for (const p of portjai2(ctx)) p.ospf.jelszo = "";
        valtozott2(ctx, 4);
      }
    }
  ];
  var egyebInterfesz = [
    {
      modok: IF_MODOK4,
      szavak: [
        IP3,
        { szo: "mtu", sugo: "Az IPv4-csomagok legnagyobb mérete ezen az interfészen" },
        { param: "szam", kulcs: "n", min: 68, max: 1500, nev: "<68-1500>", sugo: "Bájt (alapból 1500)" }
      ],
      vegrehajt(ctx, { n }) {
        for (const p of portjai2(ctx)) p.mtu = n === 1500 ? null : n;
        valtozott2(ctx, 4);
      }
    },
    {
      modok: IF_MODOK4,
      szavak: [SZO.no, IP3, { szo: "mtu", sugo: "Vissza az alapértékre (1500)" }],
      vegrehajt(ctx) {
        for (const p of portjai2(ctx)) p.mtu = null;
        valtozott2(ctx, 4);
      }
    },
    {
      modok: IF_MODOK4,
      szavak: [
        IPV63,
        { szo: "mtu", sugo: "Az IPv6-csomagok legnagyobb mérete ezen az interfészen" },
        { param: "szam", kulcs: "n", min: 1280, max: 1500, nev: "<1280-1500>", sugo: "Bájt (alapból 1500)" }
      ],
      vegrehajt(ctx, { n }) {
        for (const p of portjai2(ctx)) p.mtu6 = n === 1500 ? null : n;
        valtozott2(ctx, 6);
      }
    },
    {
      modok: IF_MODOK4,
      szavak: [SZO.no, IPV63, { szo: "mtu", sugo: "Vissza az alapértékre (1500)" }],
      vegrehajt(ctx) {
        for (const p of portjai2(ctx)) p.mtu6 = null;
        valtozott2(ctx, 6);
      }
    },
    {
      modok: IF_MODOK4,
      szavak: [
        { szo: "description", sugo: "Szöveges leírás az interfészhez (pl. merre megy)" },
        { param: "sor", kulcs: "szoveg", nev: "LINE", sugo: "A leírás (legfeljebb 200 karakter)" }
      ],
      vegrehajt(ctx, { szoveg }) {
        for (const p of portjai2(ctx)) p.leiras = szoveg.slice(0, 200);
      }
    },
    {
      modok: IF_MODOK4,
      szavak: [SZO.no, { szo: "description", sugo: "A leírás törlése" }],
      vegrehajt(ctx) {
        for (const p of portjai2(ctx)) p.leiras = "";
      }
    }
  ];
  var EXEC3 = ["felhasznalo", "priv"];
  var SHOW3 = { szo: "show", sugo: "Információk megjelenítése az eszközről" };
  function lista2(modok, szavak, fn) {
    return { modok, szavak, lapozhato: true, vegrehajt: (ctx, e) => ctx.kiir(...fn(ctx.eszkoz, e)) };
  }
  function showParancsok3(csalad) {
    const ELO = [
      SHOW3,
      csalad === 4 ? { szo: "ip", sugo: "IPv4-információk" } : { szo: "ipv6", sugo: "IPv6-információk" },
      { szo: "ospf", sugo: csalad === 4 ? "Az OSPF-folyamat adatai" : "Az OSPFv3-folyamat adatai" }
    ];
    const IFACE = { szo: "interface", sugo: "Az OSPF-interfészek: költség, állapot, időzítők, DR/BDR" };
    return [
      lista2(EXEC3, ELO, (r) => showOspf(r, csalad)),
      lista2(EXEC3, [...ELO, { szo: "neighbor", sugo: "A szomszédok és a szomszédság állapota" }], (r) => showOspfNeighbor(r, csalad)),
      lista2(EXEC3, [...ELO, IFACE], (r) => showOspfInterface(r, csalad)),
      lista2(EXEC3, [...ELO, IFACE, { szo: "brief", sugo: "Rövid táblázat interfészenként" }], (r) => showOspfIntBrief(r, csalad)),
      lista2(EXEC3, [...ELO, IFACE, { param: "interfesz", kulcs: "interfesz", sugo: "Az interfész neve" }], (r, e) => showOspfInterface(r, csalad, e.interfesz)),
      lista2(EXEC3, [...ELO, { szo: "database", sugo: "A link-state adatbázis (LSDB): az összegyűjtött LSA-k" }], (r) => showOspfDatabase(r, csalad))
    ];
  }
  function clearParancs(csalad) {
    return {
      modok: ["priv"],
      szavak: [
        { szo: "clear", sugo: "Törlés (táblák, számlálók)" },
        csalad === 4 ? { szo: "ip", sugo: "IPv4" } : { szo: "ipv6", sugo: "IPv6" },
        { szo: "ospf", sugo: csalad === 4 ? "OSPF" : "OSPFv3" },
        { szo: "process", sugo: "A folyamat újraindítása (minden szomszédság újraépül)" }
      ],
      vegrehajt(ctx) {
        const r = ctx.eszkoz;
        if (!(csalad === 4 ? r.ospf : r.ospf6)) return;
        ctx.kerdez(csalad === 4 ? "Reset ALL OSPF processes? [no]: " : "Reset ALL OSPFv3 processes? [no]: ", (valasz) => {
          const v = valasz.trim().toLowerCase();
          if (v === "y" || v === "yes") ospfTorol(r, csalad);
        });
      }
    };
  }
  var DBG_NEV = {
    ospfHello: "OSPF hello debugging is",
    ospfAdj: "OSPF adjacency debugging is",
    ospf6Hello: "OSPFv3 hello debugging is",
    ospf6Adj: "OSPFv3 adjacency debugging is"
  };
  function debugParancsok() {
    const l = [];
    for (const csalad of [4, 6]) {
      for (const [szo, mezo, sugo2] of [["hello", "Hello", "A Hello csomagok (küldés, fogadás, eltérések)"], ["adj", "Adj", "A szomszédság felépülése (DBD, DR/BDR, hitelesítés)"]]) {
        const kulcs2 = `${csalad === 4 ? "ospf" : "ospf6"}${mezo}`;
        const elo = [
          csalad === 4 ? { szo: "ip", sugo: "IPv4-es hibakeresés" } : { szo: "ipv6", sugo: "IPv6-os hibakeresés" },
          { szo: "ospf", sugo: csalad === 4 ? "Az OSPF üzenetei" : "Az OSPFv3 üzenetei" },
          { szo, sugo: sugo2 }
        ];
        const be = (ertek) => (ctx) => {
          ctx.eszkoz.debug[kulcs2] = ertek;
          ctx.kiir(`${DBG_NEV[kulcs2]} ${ertek ? "on" : "off"}`);
        };
        l.push({ modok: ["priv"], szavak: [{ szo: "debug", sugo: "Hibakereső üzenetek bekapcsolása" }, ...elo], vegrehajt: be(true) });
        l.push({ modok: ["priv"], szavak: [{ szo: "undebug", sugo: "Hibakereső üzenetek kikapcsolása" }, ...elo], vegrehajt: be(false) });
      }
    }
    return l;
  }
  function mentes(ctx) {
    ctx.kiir("Building configuration...", "[OK]");
  }
  var execParancsok = [
    ...showParancsok3(4),
    ...showParancsok3(6),
    clearParancs(4),
    clearParancs(6),
    ...debugParancsok(),
    { modok: ["priv"], szavak: [{ szo: "write", sugo: "A konfiguráció mentése" }], vegrehajt: mentes },
    { modok: ["priv"], szavak: [{ szo: "write", sugo: "A konfiguráció mentése" }, { szo: "memory", sugo: "A futó konfiguráció mentése az indulóba (startup-config)" }], vegrehajt: mentes }
  ];
  var ospfParancsok = [
    ...folyamatParancsok,
    ...almodParancsok,
    ...kozosInterfesz(4),
    ...kozosInterfesz(6),
    ...hitelesitesParancsok,
    ...egyebInterfesz,
    ...execParancsok
  ];

  // src/gyartok/ios/index.js
  var TIPUS_LEIRASOK = {
    FastEthernet: "FastEthernet (100 Mbit/s) port",
    GigabitEthernet: "GigabitEthernet (1 Gbit/s) port",
    Serial: "Soros (WAN) port",
    Loopback: "Loopback (virtuális, mindig működő) interfész"
  };
  var ios = {
    nev: "ios",
    felirat: "IOS-szerű parancssor",
    modok: MODOK,
    kezdoMod: "felhasznalo",
    parancsok: [...alapParancsok, ...vlanParancsok, ...interfeszParancsok, ...switchportParancsok, ...showParancsok, ...vtpParancsok, ...megNincsParancsok],
    formazHiba,
    formazSugo,
    /** Az értelmezőnek szükséges eszközadatok. */
    kornyezet(eszkoz) {
      return { portTipusok: portTipusok(eszkoz), tipusLeirasok: TIPUS_LEIRASOK };
    },
    /**
     * Módváltáskor: ha a konfigurációs módból kilépünk, az eszköz naplóüzenetet ír
     * (először kiírja az új promptot, utána jön az üzenet – így néz ki a valódi konzolon is).
     */
    modValtasKor(regi, uj, ctx) {
      if (MODOK[regi].konfig && !MODOK[uj].konfig) {
        ctx.kiir(ctx.prompt());
        ctx.naplo("%SYS-5-CONFIG_I: Configured from console by console");
      }
    },
    /** Ctrl+Z: konfigurációs módból vissza a privilegizált módba. */
    ctrlZ(ctx) {
      if (MODOK[ctx.mod].konfig) ctx.modValt("priv");
    }
  };
  var iosRouter = {
    ...ios,
    parancsok: [...alapParancsok, ...interfeszKozos, ...routerKonfigParancsok, ...routerExecParancsok, ...ospfParancsok, ...routerMegNincsParancsok],
    kornyezet(eszkoz) {
      return { portTipusok: routerPortTipusok(eszkoz), tipusLeirasok: TIPUS_LEIRASOK };
    }
  };
  function szemelyiseg(eszkoz) {
    return eszkoz && eszkoz.tipus === "router" ? iosRouter : ios;
  }

  // src/nezet/terminal.js
  var OLDAL_SOROK = 23;
  var MAX_SOROK = 1e3;
  function elem(tag, osztaly, szoveg) {
    const e = document.createElement(tag);
    if (osztaly) e.className = osztaly;
    if (szoveg !== void 0) e.textContent = szoveg;
    return e;
  }
  var Terminal = class {
    /**
     * @param {HTMLElement} szulo – ide kerül a terminál
     * @param {import('../cli/terminal-munkamenet.js').Munkamenet} munkamenet
     * @param {{cim?: string, parancsUtan?: (sor: string) => void}} [beallitasok]
     */
    constructor(szulo, munkamenet, beallitasok = {}) {
      this.mm = munkamenet;
      this.beallitasok = beallitasok;
      this.tortenetIndex = null;
      this.piszkozat = "";
      this.foglalt = false;
      this.lapozas = null;
      this.doboz = elem("section", "hsz-terminal");
      this.doboz.setAttribute("aria-label", "IOS-szerű parancssor");
      this.fej = elem("div", "hsz-terminal__fej");
      this.fejCim = elem("span", "hsz-terminal__cim");
      this.fej.append(elem("span", "hsz-terminal__pottyok"), this.fejCim);
      this.kepernyo = elem("div", "hsz-terminal__kepernyo");
      this.kimenet = elem("div", "hsz-terminal__kimenet");
      this.kimenet.setAttribute("role", "log");
      this.kimenet.setAttribute("aria-live", "polite");
      this.sor = elem("div", "hsz-terminal__sor");
      this.promptElem = elem("span", "hsz-terminal__prompt");
      this.bevitel = elem("input", "hsz-terminal__bevitel");
      Object.assign(this.bevitel, { type: "text", autocomplete: "off", spellcheck: false });
      this.bevitel.setAttribute("autocapitalize", "off");
      this.bevitel.setAttribute("autocorrect", "off");
      this.bevitel.setAttribute("aria-label", "Parancs");
      this.bevitel.setAttribute("enterkeyhint", "send");
      this.sor.append(this.promptElem, this.bevitel);
      this.kepernyo.append(this.kimenet, this.sor);
      this.gombsor = elem("div", "hsz-terminal__gombok");
      this.gombok = {
        sugo: this.gomb("?", "Súgó", () => this.sugo()),
        tab: this.gomb("Tab", "Kiegészítés", () => this.tab()),
        fel: this.gomb("↑", "Előző parancs", () => this.tortenetLep(-1)),
        le: this.gomb("↓", "Következő parancs", () => this.tortenetLep(1)),
        ctrlz: this.gomb("Ctrl+Z", "Kilépés a konfigurációs módból", () => this.ctrlZ()),
        tovabb: this.gomb("Tovább", "Következő oldal (szóköz)", () => this.lapozasLep("oldal")),
        kilep: this.gomb("Kilépés", "A lista vége (q)", () => this.lapozasLep("kilep"))
      };
      this.doboz.append(this.fej, this.kepernyo, this.gombsor);
      szulo.append(this.doboz);
      this.bevitel.addEventListener("keydown", (e) => this.billentyu(e));
      this.bevitel.addEventListener("input", () => this.bevitelValtozott());
      this.kepernyo.addEventListener("click", () => {
        if (!window.getSelection || String(window.getSelection()) === "") this.fokusz();
      });
      this.kepernyo.tabIndex = -1;
      this.kepernyo.addEventListener("keydown", (e) => {
        if (this.lapozas && e.target === this.kepernyo) this.lapozasBillentyu(e);
      });
      this.frissitPrompt();
      this.gombAllapot();
    }
    /** @private */
    gomb(felirat, cim, fn) {
      const g = elem("button", "hsz-terminal__gomb", felirat);
      g.type = "button";
      g.title = cim;
      g.setAttribute("aria-label", cim);
      g.addEventListener("mousedown", (e) => e.preventDefault());
      g.addEventListener("click", () => {
        fn();
        if (!this.lapozas) this.fokusz();
      });
      this.gombsor.append(g);
      return g;
    }
    fokusz() {
      if (this.lapozas) this.kepernyo.focus({ preventScroll: true });
      else this.bevitel.focus({ preventScroll: true });
    }
    /** A fejléc felirata (pl. a gépnév). */
    cim(szoveg) {
      this.fejCim.textContent = szoveg;
    }
    // -------------------------------------------------------------------------
    // Kiírás
    // -------------------------------------------------------------------------
    /** Egy kimeneti sor. A „[Szimulátor]” kezdetű sorok a szimulátor saját megjegyzései. */
    kiirSor(szoveg) {
      const s = elem("div", "hsz-terminal__kisor");
      if (szoveg.startsWith("[Szimulátor]")) s.classList.add("hsz-terminal__megjegyzes");
      s.textContent = szoveg === "" ? " " : szoveg;
      this.kimenet.append(s);
      this.vagas();
    }
    /** A beírt sor visszaírása: sárga prompt + fehér parancs. */
    visszhang(prompt, szoveg) {
      const s = elem("div", "hsz-terminal__kisor");
      s.append(elem("span", "hsz-terminal__prompt", prompt), document.createTextNode(szoveg));
      if (!prompt && !szoveg) s.textContent = " ";
      this.kimenet.append(s);
      this.vagas();
    }
    /** @private – a túl régi sorok eldobása, és görgetés az aljára */
    vagas() {
      while (this.kimenet.childElementCount > MAX_SOROK) this.kimenet.firstElementChild.remove();
      this.kepernyo.scrollTop = this.kepernyo.scrollHeight;
    }
    frissitPrompt() {
      this.promptElem.textContent = this.mm.prompt();
    }
    /** @private */
    gombAllapot() {
      const lapoz = !!this.lapozas;
      const nincs = {
        sugo: this.mm.sugoBillentyu === false,
        tab: this.mm.vanTab === false,
        ctrlz: this.mm.vanCtrlZ === false
      };
      for (const [nev, g] of Object.entries(this.gombok)) {
        const lapozoGomb = nev === "tovabb" || nev === "kilep";
        g.hidden = lapoz ? !lapozoGomb : lapozoGomb || !!nincs[nev];
        g.disabled = this.foglalt && !lapoz;
      }
    }
    /**
     * Magától érkező sor (pl. az eszköz naplóüzenete, %LINK-3-UPDOWN): a beírás alatt álló
     * sor fölé kerül, a gépelést nem zavarja.
     */
    aszinkronSor(szoveg) {
      this.kiirSor(szoveg);
    }
    /**
     * Kimenet kiírása sorban. A { varj: ms } elemeknél vár; a { folyamat } elem fokozatosan ír
     * (pl. a ping válaszai, ahogy megérkeznek); { torles } = képernyőtörlés. Lapozható kimenetnél
     * oldalanként megáll (--More--).
     * @param {Array<string|{varj:number}|{folyamat: Function}|{torles: true}>} elemek
     * @param {boolean} lapozhato
     */
    async kiirMind(elemek, lapozhato) {
      this.foglalt = true;
      this.sor.hidden = true;
      this.gombAllapot();
      if (lapozhato && elemek.length > OLDAL_SOROK) {
        await new Promise((kesz) => this.lapozasIndit(elemek, kesz));
      } else {
        for (const e of elemek) {
          if (typeof e === "string") this.kiirSor(e);
          else if (e.folyamat) {
            let folytatott = null;
            const kiir = (sor2) => {
              folytatott = null;
              this.kiirSor(sor2);
            };
            const hozzafuz = (t) => {
              if (!folytatott) {
                folytatott = elem("div", "hsz-terminal__kisor");
                this.kimenet.append(folytatott);
              }
              folytatott.textContent += t;
              this.vagas();
            };
            await new Promise((kesz) => e.folyamat(kiir, kesz, hozzafuz));
          } else if (e.torles) this.kimenet.textContent = "";
          else await new Promise((r) => setTimeout(r, e.varj));
        }
      }
      this.foglalt = false;
      this.sor.hidden = false;
      this.frissitPrompt();
      this.gombAllapot();
      this.vagas();
      this.fokusz();
    }
    // -------------------------------------------------------------------------
    // Lapozás (--More--)
    // -------------------------------------------------------------------------
    /** @private */
    lapozasIndit(sorok, kesz) {
      this.lapozas = { sorok: sorok.filter((s) => typeof s === "string"), hol: 0, kesz, more: null };
      this.lapozasKiir(OLDAL_SOROK);
    }
    /** @private – `db` sor kiírása, utána --More--, vagy vége */
    lapozasKiir(db) {
      const l = this.lapozas;
      if (l.more) l.more.remove();
      const veg = Math.min(l.sorok.length, l.hol + db);
      for (; l.hol < veg; l.hol++) this.kiirSor(l.sorok[l.hol]);
      if (l.hol >= l.sorok.length) return this.lapozasVege();
      l.more = elem("div", "hsz-terminal__kisor hsz-terminal__more", " --More-- ");
      this.kimenet.append(l.more);
      this.vagas();
      this.gombAllapot();
      this.kepernyo.focus({ preventScroll: true });
    }
    /** @private */
    lapozasVege() {
      const l = this.lapozas;
      if (l.more) l.more.remove();
      this.lapozas = null;
      l.kesz();
    }
    /** @private */
    lapozasLep(mit) {
      if (!this.lapozas) return;
      if (mit === "oldal") this.lapozasKiir(OLDAL_SOROK);
      else if (mit === "sor") this.lapozasKiir(1);
      else this.lapozasVege();
    }
    /** @private */
    lapozasBillentyu(e) {
      e.preventDefault();
      if (e.key === " ") this.lapozasLep("oldal");
      else if (e.key === "Enter") this.lapozasLep("sor");
      else if (e.key.length === 1 || e.key === "Escape") this.lapozasLep("kilep");
    }
    // -------------------------------------------------------------------------
    // Bevitel
    // -------------------------------------------------------------------------
    /** @private */
    billentyu(e) {
      if (this.lapozas) return this.lapozasBillentyu(e);
      if (this.foglalt) {
        e.preventDefault();
        return;
      }
      const ctrl = e.ctrlKey && !e.altKey && !e.metaKey;
      const k = e.key;
      if (k === "Enter") {
        e.preventDefault();
        this.enter();
      } else if (k === "Tab") {
        e.preventDefault();
        this.tab();
      } else if (k === "?" && this.mm.sugoBillentyu !== false) {
        e.preventDefault();
        this.sugo();
      } else if (k === "ArrowUp" || ctrl && (k === "p" || k === "P")) {
        e.preventDefault();
        this.tortenetLep(-1);
      } else if (k === "ArrowDown" || ctrl && (k === "n" || k === "N")) {
        e.preventDefault();
        this.tortenetLep(1);
      } else if (ctrl && (k === "z" || k === "Z")) {
        e.preventDefault();
        this.ctrlZ();
      } else if (ctrl && (k === "a" || k === "A")) {
        e.preventDefault();
        this.bevitel.setSelectionRange(0, 0);
      } else if (ctrl && (k === "e" || k === "E")) {
        e.preventDefault();
        const n = this.bevitel.value.length;
        this.bevitel.setSelectionRange(n, n);
      }
    }
    /** Telefonon a ? nem mindig jön billentyűeseményként: itt kapjuk el. */
    bevitelValtozott() {
      if (this.mm.sugoBillentyu === false) return;
      const v = this.bevitel.value;
      const hol = v.indexOf("?");
      if (hol >= 0) {
        this.bevitel.value = v.slice(0, hol) + v.slice(hol + 1);
        this.bevitel.setSelectionRange(hol, hol);
        this.sugo();
      }
    }
    /** @private */
    enter() {
      const szoveg = this.bevitel.value;
      const prompt = this.mm.prompt();
      this.bevitel.value = "";
      this.tortenetIndex = null;
      this.visszhang(prompt, szoveg);
      const r = this.mm.bevitel(szoveg);
      if (this.beallitasok.parancsUtan && szoveg.trim() !== "") this.beallitasok.parancsUtan(szoveg);
      this.kiirMind(r.kimenet, r.lapozhato);
    }
    /** ? – súgó a kurzor előtti szöveghez; utána a sor visszakerül a mezőbe. */
    sugo() {
      var _a;
      if (this.foglalt) return;
      const teljes = this.bevitel.value;
      const kurzor = (_a = this.bevitel.selectionStart) != null ? _a : teljes.length;
      const eleje = teljes.slice(0, kurzor);
      this.visszhang(this.mm.prompt(), eleje + "?");
      const r = this.mm.sugo(eleje);
      for (const s of r.kimenet) this.kiirSor(s);
      this.bevitel.value = eleje;
      this.frissitPrompt();
      this.fokusz();
    }
    /** Tab – kiegészítés (ha nem egyértelmű, nem változik semmi, mint a valódi eszközön). */
    tab() {
      if (this.foglalt) return;
      const uj = this.mm.kiegeszit(this.bevitel.value);
      if (uj !== null) this.bevitel.value = uj;
      const n = this.bevitel.value.length;
      this.bevitel.setSelectionRange(n, n);
    }
    /** Ctrl+Z – vissza a privilegizált módba. */
    ctrlZ() {
      if (this.foglalt || this.mm.vanCtrlZ === false) return;
      const prompt = this.mm.prompt();
      const szoveg = this.bevitel.value;
      this.bevitel.value = "";
      this.tortenetIndex = null;
      this.visszhang(prompt, szoveg + "^Z");
      const r = this.mm.ctrlZ();
      this.kiirMind(r.kimenet, false);
    }
    /** Előzmények: -1 = régebbi, +1 = újabb. */
    tortenetLep(irany) {
      if (this.foglalt) return;
      const lista3 = this.mm.tortenet();
      if (lista3.length === 0) return;
      if (this.tortenetIndex === null) {
        if (irany > 0) return;
        this.piszkozat = this.bevitel.value;
        this.tortenetIndex = lista3.length;
      }
      const uj = this.tortenetIndex + irany;
      if (uj < 0) return;
      if (uj >= lista3.length) {
        this.tortenetIndex = null;
        this.bevitel.value = this.piszkozat;
      } else {
        this.tortenetIndex = uj;
        this.bevitel.value = lista3[uj];
      }
      const n = this.bevitel.value.length;
      requestAnimationFrame(() => this.bevitel.setSelectionRange(n, n));
    }
  };

  // src/nezet/topologia.js
  var SVG_NS = "http://www.w3.org/2000/svg";
  function svg(tag, attr = {}, szoveg) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attr)) e.setAttribute(k, String(v));
    if (szoveg !== void 0) e.textContent = szoveg;
    return e;
  }
  var SW = { szel: 520, mag: 96, portSzel: 22, portMag: 17, koz: 4, nagyitas: 0.6 };
  var PC = { szel: 80, mag: 66 };
  var RT = { szel: 76, mag: 48 };
  var MOD_SZOVEG = { access: "access", trunk: "trunk", "dinamikus-auto": "dynamic auto", "dinamikus-kezdemenyezo": "dynamic desirable" };
  function adatFeliratok(adat) {
    return adat && adat.feliratok || [];
  }
  function swPortHely(p) {
    const sorszam = Number(p.szam.split("/")[1]);
    const kezdX = 82;
    if (p.tipus === "FastEthernet") {
      const oszlop = Math.floor((sorszam - 1) / 2);
      const csoport = Math.floor(oszlop / 6);
      return {
        x: kezdX + oszlop * (SW.portSzel + SW.koz) + csoport * 10,
        y: sorszam % 2 === 1 ? 24 : 24 + SW.portMag + 14,
        sorszam
      };
    }
    return {
      x: kezdX + 12 * (SW.portSzel + SW.koz) + 2 * 10 + 34 + (sorszam - 1) * (SW.portSzel + 10),
      y: 24 + (SW.portMag + 14) / 2,
      sorszam
    };
  }
  var Topologia = class {
    /**
     * @param {HTMLElement} szulo
     * @param {{elemek: {eszkoz: Object, x: number, y: number, tipus: string}[], halozat: Object,
     *          meret?: {szel: number, mag: number}}} adat
     * @param {{valaszt?: (eszkoz: Object) => void, sebesseg?: () => number}} [beallitasok]
     */
    constructor(szulo, { elemek, halozat, meret, feliratok }, beallitasok = {}) {
      this.elemek = elemek;
      this.halozat = halozat;
      this.vanVtp = elemek.filter((e) => e.tipus === "switch").length > 1;
      this.vanSwitch = elemek.some((e) => e.tipus === "switch");
      this.vanRouter = elemek.some((e) => e.tipus === "router");
      this.vanSoros = halozat.kabelek.some((k) => k.soros);
      this.beallitasok = beallitasok;
      const m = meret || { szel: 800, mag: 400 };
      this.doboz = document.createElement("section");
      this.doboz.className = "hsz-topologia";
      this.doboz.setAttribute("aria-label", "Topológia");
      this.rajz = svg("svg", { viewBox: `0 0 ${m.szel} ${m.mag}`, class: "hsz-topologia__rajz", role: "group" });
      this.rajz.append(svg("title", {}, "A hálózat rajza – kattints egy eszközre a kezeléséhez"));
      const defs = svg("defs");
      const marker = svg("marker", { id: "hsz-nyilhegy", viewBox: "0 0 10 10", refX: 6, refY: 5, markerWidth: 4, markerHeight: 4, orient: "auto-start-reverse" });
      marker.append(svg("path", { d: "M 0 0 L 10 5 L 0 10 z", class: "hsz-router__nyilhegy" }));
      defs.append(marker);
      this.rajz.append(defs);
      this.kabelReteg = svg("g", { class: "hsz-kabelek" });
      this.eszkozReteg = svg("g");
      this.animReteg = svg("g", { class: "hsz-anim" });
      this.rajz.append(this.kabelReteg, this.eszkozReteg, this.animReteg);
      this.doboz.append(this.rajz, this.jelmagyarazat());
      szulo.append(this.doboz);
      this.rajzok = /* @__PURE__ */ new Map();
      for (const e of elemek) {
        const r = e.tipus === "switch" ? this.switchRajz(e) : e.tipus === "router" ? this.routerRajz(e) : this.pcRajz(e);
        this.rajzok.set(e.eszkoz, r);
      }
      for (const f of adatFeliratok({ feliratok })) this.felirat(f);
      this.kabelek = halozat.kabelek.map((k) => this.kabelRajz(k));
      this.mozgok = [];
      this.animFut = false;
      this.leiratkozas = halozat.figyel((e) => this.esemeny(e));
      this.frissit();
    }
    /** @private */
    jelmagyarazat() {
      const j = document.createElement("p");
      j.className = "hsz-jelmagyarazat";
      j.innerHTML = `<span><i class="hsz-potty hsz-potty--arp"></i>${this.vanRouter ? "ARP / ND" : "ARP"}</span><span><i class="hsz-potty hsz-potty--icmp"></i>ping (ICMP)</span>` + (this.vanRouter ? '<span data-fajta="rip" hidden><i class="hsz-potty hsz-potty--rip"></i>RIP / RIPng</span>' : "") + (this.vanRouter ? '<span data-fajta="ospf" hidden><i class="hsz-potty hsz-potty--ospf"></i>OSPF</span>' : "") + (this.vanVtp ? '<span><i class="hsz-potty hsz-potty--vtp"></i>VTP-hirdetés</span>' : "") + (this.vanSwitch ? '<span><b class="hsz-cimke-minta">10</b>802.1Q-címke (VLAN)</span>' : "") + '<span><b class="hsz-x-minta">✕</b>eldobott keret</span>' + (this.vanSwitch ? '<span><i class="hsz-vonal-minta"></i>trunk</span>' : "") + (this.vanSoros ? '<span><i class="hsz-vonal-minta hsz-vonal-minta--soros"></i>soros vonal (lassú)</span>' : "");
      return j;
    }
    /** @private – kattintható csoport egy eszköznek */
    kattinthato(g, eszkoz, leiras) {
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", leiras);
      const valaszt = () => this.beallitasok.valaszt && this.beallitasok.valaszt(eszkoz);
      g.addEventListener("click", valaszt);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          valaszt();
        }
      });
    }
    /** @private – egy switch kirajzolása (kicsinyítve) */
    switchRajz({ eszkoz, x, y }) {
      const n = SW.nagyitas;
      const kulso = svg("g", { class: "hsz-eszkoz" });
      this.kattinthato(kulso, eszkoz, `Switch: ${eszkoz.hostname} – kattints, és írj a parancssorába`);
      const g = svg("g", { transform: `translate(${x} ${y}) scale(${n})` });
      g.append(svg("rect", { x: 0, y: 0, width: SW.szel, height: SW.mag, rx: 10, class: "hsz-eszkoz__haz" }));
      g.append(svg("rect", { x: 8, y: 8, width: SW.szel - 16, height: SW.mag - 16, rx: 6, class: "hsz-eszkoz__elolap" }));
      g.append(svg("circle", { cx: 28, cy: 34, r: 5, class: "hsz-led hsz-led--be" }));
      g.append(svg("text", { x: 38, y: 38, class: "hsz-eszkoz__apro" }, "SYS"));
      g.append(svg("circle", { cx: 28, cy: 56, r: 5, class: "hsz-led" }));
      g.append(svg("text", { x: 38, y: 60, class: "hsz-eszkoz__apro" }, "MODE"));
      const portok = /* @__PURE__ */ new Map();
      for (const p of eszkoz.portok) {
        const h = swPortHely(p);
        const pg = svg("g", { class: "hsz-port" });
        const cim = svg("title");
        pg.append(cim);
        pg.append(svg("rect", { x: h.x, y: h.y, width: SW.portSzel, height: SW.portMag, rx: 2, class: "hsz-port__aljzat" }));
        pg.append(svg("rect", { x: h.x + 6, y: h.y + SW.portMag - 6, width: SW.portSzel - 12, height: 4, class: "hsz-port__nyelv" }));
        const led = svg("rect", { x: h.x + 5, y: h.y - 7, width: SW.portSzel - 10, height: 4, rx: 1, class: "hsz-led" });
        pg.append(led);
        const felul = p.tipus === "FastEthernet" && h.sorszam % 2 === 1;
        const szam = p.tipus === "FastEthernet" ? String(h.sorszam) : `G${h.sorszam}`;
        pg.append(svg("text", { x: h.x + SW.portSzel / 2, y: felul ? h.y - 10 : h.y + SW.portMag + 11, class: "hsz-eszkoz__apro hsz-kozep" }, szam));
        g.append(pg);
        portok.set(p.nev, {
          x: x + n * (h.x + SW.portSzel / 2),
          y: y + n * (h.y + SW.portMag / 2),
          led,
          pg,
          cim
        });
      }
      const felirat = svg("text", { x, y: y - 9, class: "hsz-eszkoz__nev" });
      const nev = svg("tspan");
      const tipus = svg("tspan", { class: "hsz-eszkoz__tipus", dx: 8 }, "2960-24 jellegű switch");
      felirat.append(nev, tipus);
      kulso.append(g, felirat);
      this.eszkozReteg.append(kulso);
      return { g: kulso, felirat: nev, portok, also: y + n * SW.mag, felso: y, tipus: "switch" };
    }
    /** @private – egy PC kirajzolása */
    pcRajz({ eszkoz, x, y }) {
      const g = svg("g", { class: "hsz-eszkoz hsz-eszkoz--pc", transform: `translate(${x} ${y})` });
      this.kattinthato(g, eszkoz, `PC: ${eszkoz.hostname} – kattints a beállításaihoz és a parancssorához`);
      g.append(svg("rect", { x: 0, y: 0, width: PC.szel, height: 52, rx: 6, class: "hsz-eszkoz__haz" }));
      g.append(svg("rect", { x: 6, y: 6, width: PC.szel - 12, height: 38, rx: 2, class: "hsz-pc__kepernyo" }));
      g.append(svg("text", { x: 11, y: 20, class: "hsz-pc__prompt" }, "C:\\>_"));
      g.append(svg("rect", { x: PC.szel / 2 - 6, y: 52, width: 12, height: 8, class: "hsz-eszkoz__haz" }));
      g.append(svg("rect", { x: PC.szel / 2 - 20, y: 59, width: 40, height: 7, rx: 3, class: "hsz-eszkoz__haz" }));
      const led = svg("circle", { cx: PC.szel - 9, cy: 48, r: 2.5, class: "hsz-led" });
      const cim = svg("title");
      g.append(led, cim);
      const felirat = svg("text", { x: PC.szel / 2, y: PC.mag + 18, class: "hsz-eszkoz__nev hsz-kozep" });
      const ipFelirat = svg("text", { x: PC.szel / 2, y: PC.mag + 34, class: "hsz-eszkoz__ip hsz-kozep" });
      g.append(felirat, ipFelirat);
      this.eszkozReteg.append(g);
      const portok = /* @__PURE__ */ new Map([[eszkoz.portok[0].nev, { x: x + PC.szel / 2, y, led, cim }]]);
      return { g, felirat, ipFelirat, portok, tipus: "pc" };
    }
    /** @private – egy router kirajzolása (saját rajz: henger, rajta négy nyíl) */
    routerRajz({ eszkoz, x, y, felirat: hely }) {
      const g = svg("g", { class: "hsz-eszkoz hsz-eszkoz--router", transform: `translate(${x} ${y})` });
      this.kattinthato(g, eszkoz, `Router: ${eszkoz.hostname} – kattints, és írj a parancssorába`);
      const w = RT.szel / 2;
      const fel = RT.mag / 2;
      const ry = 11;
      g.append(svg("path", {
        d: `M ${-w} ${-fel + ry} L ${-w} ${fel - ry} A ${w} ${ry} 0 0 0 ${w} ${fel - ry} L ${w} ${-fel + ry} Z`,
        class: "hsz-eszkoz__haz"
      }));
      g.append(svg("ellipse", { cx: 0, cy: -fel + ry, rx: w, ry, class: "hsz-router__teto" }));
      const nyil = (x1, y1, x2, y2) => g.append(svg("path", { d: `M ${x1} ${y1} L ${x2} ${y2}`, class: "hsz-router__nyil", "marker-end": "url(#hsz-nyilhegy)" }));
      const ty = -fel + ry;
      nyil(-27, ty - 5, -10, ty - 1);
      nyil(27, ty + 5, 10, ty + 1);
      nyil(-6, ty + 2, -24, ty + 7);
      nyil(6, ty - 2, 24, ty - 7);
      const cim = svg("title");
      g.append(cim);
      const HELYEK = {
        lent: { x: 0, y: fel + 17, d: 13, igazit: "middle" },
        fent: { x: 0, y: -fel - 20, d: 13, igazit: "middle" },
        balra: { x: -w - 8, y: -2, d: 14, igazit: "end" },
        jobbra: { x: w + 8, y: -2, d: 14, igazit: "start" }
      };
      const h = HELYEK[hely] || HELYEK.lent;
      const nev = svg("text", { x: h.x, y: h.y, class: "hsz-eszkoz__nev", "text-anchor": h.igazit });
      const tipus = svg("text", { x: h.x, y: h.y + h.d, class: "hsz-eszkoz__tipus", "text-anchor": h.igazit }, "ISR 4331 jellegű router");
      g.append(nev, tipus);
      this.eszkozReteg.append(g);
      const portok = /* @__PURE__ */ new Map();
      for (const p of eszkoz.portok) portok.set(p.nev, { x, y });
      return { g, felirat: nev, cim, portok, tipus: "router", kozep: { x, y } };
    }
    /** @private – szöveg a rajzon (pl. egy link hálózatcíme); több sor: \n */
    felirat({ x, y, szoveg, igazit: igazit2 = "middle", halvany = false }) {
      const t = svg("text", { x, y, class: `hsz-terkep-felirat${halvany ? " hsz-terkep-felirat--halvany" : ""}`, "text-anchor": igazit2 });
      String(szoveg).split("\n").forEach((sor2, i) => t.append(svg("tspan", { x, dy: i ? 13 : 0 }, sor2)));
      this.kabelReteg.append(t);
    }
    /** @private – egy kábel útvonala és portcímkéi */
    kabelRajz(k) {
      const ra = this.rajzok.get(k.a.eszkoz);
      const rb = this.rajzok.get(k.b.eszkoz);
      const pa = ra.portok.get(k.a.port.nev);
      const pb = rb.portok.get(k.b.port.nev);
      let d;
      const cimkek = [];
      if (ra.tipus === "router" || rb.tipus === "router") {
        d = `M ${pa.x} ${pa.y} L ${pb.x} ${pb.y}`;
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const hossz = Math.hypot(dx, dy) || 1;
        const ux = dx / hossz;
        const uy = dy / hossz;
        const cimke = (vege, r, p, tav2) => {
          const elojel = vege === "a" ? 1 : -1;
          const bx = p.x + ux * tav2 * elojel;
          const by = p.y + uy * tav2 * elojel;
          const szoveg = (vege === "a" ? k.a : k.b).port.rovid;
          const tol = Math.abs(uy) * (szoveg.length * 3.4 + 5) + Math.abs(ux) * 9;
          const nx = -uy * tol * elojel;
          const ny = ux * tol * elojel;
          return { x: bx + nx, y: by + ny + 4, szoveg, igazit: "middle" };
        };
        const tav = (r) => r.tipus === "router" ? 62 : 14;
        cimkek.push(cimke("a", ra, pa, tav(ra)));
        cimkek.push(cimke("b", rb, pb, tav(rb)));
      } else if (ra.tipus === "switch" && rb.tipus === "switch") {
        const fent = Math.min(ra.felso, rb.felso) - 30;
        d = `M ${pa.x} ${pa.y} L ${pa.x} ${fent} L ${pb.x} ${fent} L ${pb.x} ${pb.y}`;
        cimkek.push({ x: pa.x + 5, y: ra.felso - 5, szoveg: k.a.port.rovid, igazit: "start" });
        cimkek.push({ x: pb.x - 5, y: rb.felso - 5, szoveg: k.b.port.rovid, igazit: "end" });
      } else {
        const [sw, swp, swk, pcp] = ra.tipus === "switch" ? [ra, pa, k.a, pb] : [rb, pb, k.b, pa];
        const ki = sw.also + 10;
        const forditott = sw !== ra;
        d = forditott ? `M ${pcp.x} ${pcp.y} C ${pcp.x} ${pcp.y - 80} ${swp.x} ${ki + 70} ${swp.x} ${ki} L ${swp.x} ${swp.y}` : `M ${swp.x} ${swp.y} L ${swp.x} ${ki} C ${swp.x} ${ki + 70} ${pcp.x} ${pcp.y - 80} ${pcp.x} ${pcp.y}`;
        const balra = pcp.x < swp.x;
        cimkek.push({ x: swp.x + (balra ? -5 : 5), y: sw.also + 14, szoveg: swk.port.rovid, igazit: balra ? "end" : "start" });
        cimkek.push({ x: pcp.x + 5, y: pcp.y - 6, szoveg: "Fa0", igazit: "start" });
      }
      const ut = svg("path", { d, class: `hsz-kabel${k.soros ? " hsz-kabel--soros" : ""}` });
      this.kabelReteg.append(ut);
      for (const c of cimkek) {
        this.kabelReteg.append(svg("text", { x: c.x, y: c.y, class: "hsz-kabel__cimke", "text-anchor": c.igazit }, c.szoveg));
      }
      return { k, ut };
    }
    /** Kijelöli az éppen kezelt eszközt. */
    kijelol(eszkoz) {
      for (const [e, r] of this.rajzok) r.g.classList.toggle("hsz-eszkoz--kijelolt", e === eszkoz);
    }
    /** Újrarajzolja a változó részeket (nevek, IP-címek, LED-ek, kábelek állapota). */
    frissit() {
      for (const [eszkoz, r] of this.rajzok) {
        r.felirat.textContent = eszkoz.hostname;
        if (r.tipus === "pc") {
          const cim = eszkoz.ip || (eszkoz.ipv6 ? eszkoz.ipv6 : "");
          r.ipFelirat.textContent = cim || "nincs IP-cím";
          r.ipFelirat.classList.toggle("hsz-eszkoz__ip--nincs", !cim);
          const p = r.portok.get(eszkoz.portok[0].nev);
          p.led.classList.toggle("hsz-led--be", eszkoz.portok[0].fent);
          p.cim.textContent = `${eszkoz.hostname} – ${eszkoz.ip || (eszkoz.ipv6 ? "nincs IPv4-cím" : "nincs IP-cím")}${eszkoz.maszk ? " / " + eszkoz.maszk : ""}` + (eszkoz.ipv6 ? `, ${eszkoz.ipv6.toLowerCase()}/${eszkoz.ipv6Hossz || 64}` : "");
          continue;
        }
        if (r.tipus === "router") {
          const sorok = eszkoz.portok.filter((p) => p.ip || p.ipv6.length).map((p) => {
            const allapot3 = p.leallitva ? "shutdown" : p.fent || p.tipus === "Loopback" ? "működik" : "nincs link";
            return `${p.rovid}: ${[p.ip, ...p.ipv6.map((c) => `${c.cim}/${c.hossz}`)].filter(Boolean).join(", ")} (${allapot3})`;
          });
          r.cim.textContent = [`${eszkoz.hostname} – router`, ...sorok].join("\n");
          continue;
        }
        for (const p of eszkoz.portok) {
          const pe = r.portok.get(p.nev);
          pe.pg.classList.toggle("hsz-port--lekapcsolva", p.leallitva);
          pe.led.classList.toggle("hsz-led--be", p.fent);
          let allapot3;
          if (p.leallitva) allapot3 = "lekapcsolva (shutdown)";
          else if (p.fent) allapot3 = uzemmod(eszkoz, p) === "trunk" ? "működik, trunk" : `működik, VLAN ${p.accessVlan}`;
          else allapot3 = "nincs kábel";
          pe.cim.textContent = `${p.nev} – ${allapot3} (mód: ${MOD_SZOVEG[p.mod]})`;
        }
      }
      for (const kr of this.kabelek) {
        const { a, b } = kr.k;
        const fent = a.port.fent && b.port.fent;
        const trunk = fent && a.eszkoz.tipus === "switch" && uzemmod(a.eszkoz, a.port) === "trunk";
        kr.ut.classList.toggle("hsz-kabel--le", !fent);
        kr.ut.classList.toggle("hsz-kabel--trunk", trunk);
      }
    }
    // -------------------------------------------------------------------------
    // Animáció
    // -------------------------------------------------------------------------
    /** @private */
    esemeny(e) {
      if (e.tipus === "keret") this.csomag(e);
      else if (e.tipus === "eldobva") this.eldobva(e);
      else if (e.tipus === "allapot") this.frissit();
    }
    /** @private – egy keret elindul egy kábelen */
    csomag(e) {
      const kr = this.kabelek.find((x) => x.k === this.halozat.kabelVege(e.honnan.eszkoz, e.honnan.port));
      if (!kr || typeof kr.ut.getTotalLength !== "function") return;
      const elore = kr.k.a.eszkoz === e.honnan.eszkoz && kr.k.a.port === e.honnan.port;
      const fajta = csomagFajta(e.keret);
      if (fajta === "rip" || fajta === "ospf") {
        const jel = this.doboz.querySelector(`.hsz-jelmagyarazat [data-fajta="${fajta}"]`);
        if (jel && jel.hidden) jel.hidden = false;
      }
      const g = svg("g", { class: `hsz-csomag hsz-csomag--${fajta}` });
      g.append(svg("circle", { r: 7 }));
      if (e.keret.vlan !== void 0) {
        const c = svg("g", { class: "hsz-csomag__cimke", transform: "translate(0 -16)" });
        c.append(svg("rect", { x: -13, y: -8, width: 26, height: 15, rx: 4 }));
        c.append(svg("text", { x: 0, y: 4, class: "hsz-kozep" }, String(e.keret.vlan)));
        g.append(c);
      }
      g.append(svg("title", {}, csomagLeiras(e.keret)));
      this.animReteg.append(g);
      const sebesseg = this.beallitasok.sebesseg ? this.beallitasok.sebesseg() : 1;
      const m = { g, ut: kr.ut, hossz: kr.ut.getTotalLength(), elore, kezd: performance.now(), ido: Math.max(1, e.idotartam / sebesseg) };
      this.mozgok.push(m);
      this.helyez(m, 0);
      setTimeout(() => this.torolMozgo(m), m.ido + 100);
      if (!this.animFut) {
        this.animFut = true;
        requestAnimationFrame((t) => this.kepkocka(t));
      }
    }
    /** @private */
    helyez(m, arany) {
      const hol = m.elore ? arany * m.hossz : (1 - arany) * m.hossz;
      const p = m.ut.getPointAtLength(hol);
      m.g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    }
    /** @private */
    torolMozgo(m) {
      m.g.remove();
      this.mozgok = this.mozgok.filter((x) => x !== m);
    }
    /** @private */
    kepkocka(most5) {
      for (const m of this.mozgok.slice()) {
        const arany = (most5 - m.kezd) / m.ido;
        if (arany >= 1) this.torolMozgo(m);
        else this.helyez(m, Math.max(0, arany));
      }
      if (this.mozgok.length) requestAnimationFrame((t) => this.kepkocka(t));
      else this.animFut = false;
    }
    /** @private – ✕ jel ott, ahol egy keret elakadt */
    eldobva(e) {
      const r = this.rajzok.get(e.eszkoz);
      const p = r && r.portok.get(e.port.nev);
      if (!p) return;
      const g = svg("g", { class: "hsz-eldobva", transform: `translate(${p.x} ${p.y + (r.tipus === "switch" ? 0 : -10)})` });
      g.append(svg("circle", { r: 10 }));
      g.append(svg("text", { x: 0, y: 5, class: "hsz-kozep" }, "✕"));
      g.append(svg("title", {}, e.ok));
      this.animReteg.append(g);
      setTimeout(() => g.remove(), 2500);
    }
  };
  function csomagFajta(k) {
    if (k.tipus === "arp" || k.tipus === "vtp") return k.tipus;
    const a = k.adat || {};
    if (a.protokoll === "udp") return "rip";
    if (a.protokoll === "ospf") return "ospf";
    if (a.protokoll === "icmpv6" && (a.icmp.tipus === "ns" || a.icmp.tipus === "na")) return "arp";
    return "icmp";
  }
  var ICMP_NEV = {
    "echo-keres": "ping-kérés (echo request)",
    "echo-valasz": "ping-válasz (echo reply)",
    "ido-lejart": "ICMP „Time exceeded” – lejárt a TTL",
    elerhetetlen: "ICMP „Destination unreachable” – nincs útvonal"
  };
  var OSPF_NEV = {
    hello: "Hello",
    dbd: "DBD (adatbázis-leírás)",
    lsr: "LSR (LSA-kérés)",
    lsu: "LSU (LSA-k küldése)",
    ack: "LSAck (nyugtázás)"
  };
  function ospfLeiras(a) {
    const o = a.ospf;
    const v = a.forrasIp ? "OSPF" : "OSPFv3";
    const ut = `${a.forrasIp || a.forras} → ${a.celIp || a.cel}`;
    if (o.tipus === "hello") {
      return `${v} Hello (${o.rid}, area ${o.terulet}): ${ut}, Hello ${o.hello} / Dead ${o.dead} mp, látott szomszédok: ${o.szomszedok.join(", ") || "még senki"}`;
    }
    if (o.tipus === "dbd") return `${v} ${OSPF_NEV.dbd} (${o.rid}): ${ut}, ${o.init ? "kezdés (ki a master?)" : `${o.fejlecek.length} LSA fejléce`}, MTU ${o.mtu}`;
    if (o.tipus === "lsr") return `${v} ${OSPF_NEV.lsr} (${o.rid}): ${ut}, ${o.kulcsok.length} LSA-t kér`;
    if (o.tipus === "lsu") return `${v} ${OSPF_NEV.lsu} (${o.rid}): ${ut}, ${o.lsak.length} LSA`;
    return `${v} ${OSPF_NEV[o.tipus] || o.tipus} (${o.rid}): ${ut}`;
  }
  function csomagLeiras(k) {
    const a = k.adat || {};
    if (a.protokoll === "ospf") return ospfLeiras(a);
    if (k.tipus === "ipv4" && a.protokoll === "udp") {
      const r = a.udp.adat;
      if (r.parancs === "keres") return `RIP-kérés: ${a.forrasIp} → ${a.celIp} (küldjétek el a táblátokat!)`;
      return `RIPv${r.verzio}-frissítés: ${a.forrasIp} → ${a.celIp}, ${r.bejegyzesek.length} útvonal: ` + r.bejegyzesek.slice(0, 6).map((e) => `${e.halozat}${e.maszk ? "" : ""} (${e.metrika})`).join(", ") + (r.bejegyzesek.length > 6 ? " …" : "");
    }
    if (k.tipus === "ipv6") {
      if (a.protokoll === "udp") {
        const r = a.udp.adat;
        if (r.parancs === "keres") return `RIPng-kérés: ${a.forras} → ${a.cel}`;
        return `RIPng-frissítés: ${a.forras} → ${a.cel}, ${r.bejegyzesek.length} útvonal: ` + r.bejegyzesek.slice(0, 5).map((e) => `${e.prefix}/${e.hossz} (${e.metrika})`).join(", ") + (r.bejegyzesek.length > 5 ? " …" : "");
      }
      if (a.icmp && a.icmp.tipus === "ns") return `IPv6 szomszédkérdés (NS): kié a(z) ${a.icmp.cel}? Kérdezi: ${a.forras}`;
      if (a.icmp && a.icmp.tipus === "na") return `IPv6 szomszédhirdetés (NA): a(z) ${a.icmp.cel} az enyém`;
      if (a.icmp) return `${ICMP_NEV[a.icmp.tipus] || "ICMPv6"} (IPv6): ${a.forras} → ${a.cel}, hop limit ${a.hop}`;
    }
    if (k.tipus === "ipv4" && a.icmp && a.icmp.tipus !== "echo-keres" && a.icmp.tipus !== "echo-valasz") {
      return `${ICMP_NEV[a.icmp.tipus]}: ${a.forrasIp} → ${a.celIp}`;
    }
    if (k.tipus === "vtp") {
      const a2 = k.adat;
      return `VTP-${a2.keres ? "kérés és hirdetés" : "hirdetés"} (${a2.kuldo}): tartomány ${a2.tartomany}, revízió ${a2.revizio}, VLAN-ok: ${Object.keys(a2.vlanok).join(", ") || "–"}`;
    }
    const cimke = k.vlan !== void 0 ? ` – 802.1Q-címke: VLAN ${k.vlan}` : "";
    if (k.tipus === "arp") {
      const a2 = k.adat;
      if (a2.muvelet === "keres") return `ARP-kérdés (szórás): kié a(z) ${a2.celIp}? Kérdezi: ${a2.kuldoIp}${cimke}`;
      return `ARP-válasz: a(z) ${a2.kuldoIp} az enyém${cimke}`;
    }
    if (k.adat && k.adat.protokoll === "icmp") {
      const fajta = k.adat.icmp.tipus === "echo-keres" ? "ping-kérés (echo request)" : "ping-válasz (echo reply)";
      return `${fajta}: ${k.adat.forrasIp} → ${k.adat.celIp}, TTL ${k.adat.ttl}${cimke}`;
    }
    return `keret${cimke}`;
  }

  // src/nezet/buborek.js
  function elem2(tag, osztaly, szoveg) {
    const e = document.createElement(tag);
    if (osztaly) e.className = osztaly;
    if (szoveg !== void 0) e.textContent = szoveg;
    return e;
  }
  function szovegbe(cel, szoveg) {
    String(szoveg || "").split("`").forEach((resz, i) => {
      if (resz === "") return;
      cel.append(i % 2 === 1 ? elem2("code", "hsz-kod", resz) : document.createTextNode(resz));
    });
    return cel;
  }
  var KOZ = 14;
  var Buborek = class {
    /** @param {HTMLElement} szulo */
    constructor(szulo) {
      this.doboz = elem2("div", "hsz-buborek");
      this.doboz.setAttribute("role", "dialog");
      this.doboz.setAttribute("aria-label", "Bemutató");
      this.doboz.hidden = true;
      this.nyil = elem2("div", "hsz-buborek__nyil");
      this.fej = elem2("div", "hsz-buborek__fej");
      this.szamlalo = elem2("span", "hsz-buborek__szamlalo");
      this.bezar = elem2("button", "hsz-buborek__x", "×");
      this.bezar.type = "button";
      this.bezar.title = "A bemutató bezárása";
      this.bezar.setAttribute("aria-label", "A bemutató bezárása");
      this.fej.append(this.szamlalo, this.bezar);
      this.szoveg = elem2("p", "hsz-buborek__szoveg");
      this.szoveg.setAttribute("aria-live", "polite");
      this.miert = elem2("p", "hsz-buborek__miert");
      this.gombok = elem2("div", "hsz-buborek__gombok");
      this.doboz.append(this.nyil, this.fej, this.szoveg, this.miert, this.gombok);
      szulo.append(this.doboz);
      this.cel = null;
      this.helyezFn = () => this.helyez();
      window.addEventListener("resize", this.helyezFn);
      window.addEventListener("scroll", this.helyezFn, true);
      this.idozito = setInterval(this.helyezFn, 400);
    }
    /**
     * @param {{cel: Element|null, szamlalo: string, szoveg: string, miert?: string,
     *          gombok: {felirat: string, fn: () => void, fo?: boolean}[], bezar: () => void, gorget?: boolean}} p
     */
    mutat(p) {
      if (this.cel && this.cel !== p.cel) this.cel.classList.remove("hsz-kiemelt");
      this.cel = p.cel;
      if (this.cel) this.cel.classList.add("hsz-kiemelt");
      this.szamlalo.textContent = p.szamlalo;
      this.szoveg.textContent = "";
      szovegbe(this.szoveg, p.szoveg);
      this.miert.textContent = "";
      if (p.miert) {
        this.miert.append(elem2("b", "", "Miért? "));
        szovegbe(this.miert, p.miert);
      }
      this.miert.hidden = !p.miert;
      this.gombok.textContent = "";
      for (const g of p.gombok) {
        const b = elem2("button", g.fo ? "hsz-gomb hsz-gomb--kicsi" : "hsz-tippgomb", g.felirat);
        b.type = "button";
        b.addEventListener("click", g.fn);
        this.gombok.append(b);
      }
      this.bezar.onclick = p.bezar;
      this.doboz.hidden = false;
      if (p.gorget && this.cel && this.cel.scrollIntoView) {
        const r = this.cel.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) this.cel.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      this.helyez();
    }
    /** Elhelyezés a cél alá (ha nem fér, fölé), vízszintesen a nézetablakon belül. */
    helyez() {
      if (this.doboz.hidden) return;
      const w = this.doboz.offsetWidth;
      const h = this.doboz.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (!this.cel || !this.cel.isConnected) {
        this.doboz.style.left = `${Math.max(8, (vw - w) / 2)}px`;
        this.doboz.style.top = `${Math.max(8, vh - h - 16)}px`;
        this.nyil.hidden = true;
        return;
      }
      const r = this.cel.getBoundingClientRect();
      let top;
      let lent = true;
      if (r.bottom + KOZ + h <= vh - 8) top = r.bottom + KOZ;
      else if (r.top - KOZ - h >= 8) {
        top = r.top - KOZ - h;
        lent = false;
      } else top = Math.max(8, vh - h - 8);
      const kozep = r.left + r.width / 2;
      const left = Math.min(Math.max(8, kozep - w / 2), Math.max(8, vw - w - 8));
      this.doboz.style.left = `${left}px`;
      this.doboz.style.top = `${top}px`;
      const latszik = r.bottom > 0 && r.top < vh;
      this.nyil.hidden = !latszik;
      this.nyil.className = `hsz-buborek__nyil hsz-buborek__nyil--${lent ? "fent" : "lent"}`;
      this.nyil.style.left = `${Math.min(Math.max(14, kozep - left), w - 14)}px`;
    }
    elrejt() {
      this.doboz.hidden = true;
      if (this.cel) this.cel.classList.remove("hsz-kiemelt");
      this.cel = null;
    }
    /** Végleges eltávolítás (feladatváltáskor). */
    megszuntet() {
      this.elrejt();
      clearInterval(this.idozito);
      window.removeEventListener("resize", this.helyezFn);
      window.removeEventListener("scroll", this.helyezFn, true);
      this.doboz.remove();
    }
  };

  // src/feladat/ellenorzo.js
  var aVlan = (n) => `${nevelo(n)} ${esRag(n)}`;
  var AVlan = (n) => {
    const t = aVlan(n);
    return t[0].toUpperCase() + t.slice(1);
  };
  var MOD_SZOVEG2 = { access: "access", trunk: "trunk", "dinamikus-auto": "dynamic auto", "dinamikus-kezdemenyezo": "dynamic desirable" };
  function rovid3(nev) {
    return nev.replace(/^FastEthernet/, "Fa").replace(/^GigabitEthernet/, "Gi").replace(/^Serial/, "Se").replace(/^Loopback/, "Lo");
  }
  function kovSzoveg(k) {
    return Array.isArray(k) ? ipv6Szoveg(k) : ipSzoveg(k);
  }
  var ALLAPOT_CELOK = {
    vlan(f, c) {
      const sw = f.eszkoz(c.eszkoz);
      const v = sw.vlanok[c.vlan];
      if (!v) return { ok: false, megjegyzes: `${AVlan(c.vlan)} VLAN nincs létrehozva (${c.eszkoz}).` };
      if (c.nev && v.nev !== c.nev) return { ok: false, megjegyzes: `A VLAN neve most: ${v.nev} (${c.nev} kellene).` };
      return { ok: true, megjegyzes: `Megvan: ${c.vlan} ${v.nev}` };
    },
    "access-port"(f, c) {
      const sw = f.eszkoz(c.eszkoz);
      const p = portKeres(sw, c.port);
      const hibak = [];
      if (p.mod !== "access") hibak.push(`a port üzemmódja most ${MOD_SZOVEG2[p.mod]} (access kellene)`);
      if (p.accessVlan !== c.vlan) hibak.push(`a port most ${aVlan(p.accessVlan)} VLAN-ban van`);
      else if (!sw.vlanok[c.vlan]) hibak.push(`${aVlan(c.vlan)} VLAN nem létezik ezen a switchen`);
      if (p.leallitva) hibak.push("a port le van kapcsolva (shutdown)");
      if (hibak.length) return { ok: false, megjegyzes: hibak.join("; ") + "." };
      return { ok: true, megjegyzes: `access, VLAN ${c.vlan}` };
    },
    trunk(f, c) {
      const sw = f.eszkoz(c.eszkoz);
      const p = portKeres(sw, c.port);
      if (!p.fent) return { ok: false, megjegyzes: `Nincs link a(z) ${rovid3(p.nev)} porton (le van kapcsolva?).` };
      const tul = sw.halozat.szomszed(sw, p);
      const vegek = [[sw, p], [tul.eszkoz, tul.port]];
      const rossz = vegek.filter(([e, pp]) => uzemmod(e, pp) !== "trunk");
      if (rossz.length) {
        const leiras = rossz.map(([e, pp]) => `${e.hostname} ${rovid3(pp.nev)}: ${MOD_SZOVEG2[pp.mod]}`).join(", ");
        return { ok: false, megjegyzes: `Nem lett trunk (${leiras}). Két „dynamic auto” port nem kezdeményez trunkot.` };
      }
      const modok = vegek.map(([e, pp]) => `${e.hostname}: ${MOD_SZOVEG2[pp.mod]}`).join(", ");
      return { ok: true, megjegyzes: `Mindkét vég trunkként működik (${modok}).` };
    },
    "vlan-nincs"(f, c) {
      const sw = f.eszkoz(c.eszkoz);
      const v = sw.vlanok[c.vlan];
      if (v) return { ok: false, megjegyzes: `${AVlan(c.vlan)} VLAN (${v.nev}) megvan ezen: ${c.eszkoz}, pedig itt nem szabadna lennie.` };
      return { ok: true, megjegyzes: `${AVlan(c.vlan)} VLAN nincs ezen: ${c.eszkoz} – ahogy kell.` };
    },
    vtp(f, c) {
      const sw = f.eszkoz(c.eszkoz);
      const hibak = [];
      if (c.mod && sw.vtpMod !== c.mod) hibak.push(`a szerep most ${sw.vtpMod} (${c.mod} kellene)`);
      if (c.tartomany !== void 0 && sw.vtpTartomany !== c.tartomany) {
        hibak.push(`a tartomány most ${sw.vtpTartomany ? `„${sw.vtpTartomany}”` : "nincs megadva"} („${c.tartomany}” kellene; kis- és nagybetű számít)`);
      }
      if (c.jelszo !== void 0 && sw.vtpJelszo !== c.jelszo) hibak.push(sw.vtpJelszo ? "a jelszó nem egyezik" : "nincs jelszó");
      if (c.verzio && sw.vtpVerzio !== c.verzio) hibak.push(`a verzió most ${sw.vtpVerzio} (${c.verzio} kellene)`);
      if (c.revizio !== void 0 && sw.vtpRevizio !== c.revizio) hibak.push(`a revízió most ${sw.vtpRevizio} (${c.revizio} kellene)`);
      if (hibak.length) return { ok: false, megjegyzes: hibak.join("; ") + "." };
      return { ok: true, megjegyzes: `${sw.vtpMod}, tartomány: ${sw.vtpTartomany}, verzió: ${sw.vtpVerzio}, revízió: ${sw.vtpMod === "transparent" ? 0 : sw.vtpRevizio}` };
    },
    "vtp-szinkron"(f, c) {
      const sw = f.eszkoz(c.eszkoz);
      const forras = f.eszkoz(c.forras);
      const lista3 = (e) => Object.entries(e.vlanok).filter(([, v]) => !v.gyari).map(([n, v]) => `${n} ${v.nev}`).sort().join(", ");
      const sajat = lista3(sw);
      const ott = lista3(forras);
      if (sw.vtpRevizio === forras.vtpRevizio && sajat === ott) {
        return { ok: true, megjegyzes: `Azonos revízió (${sw.vtpRevizio}) és azonos VLAN-ok: ${sajat || "–"}.` };
      }
      let megj = `${c.eszkoz}: revízió ${sw.vtpRevizio}, VLAN-ok: ${sajat || "–"}. ${c.forras}: revízió ${forras.vtpRevizio}, VLAN-ok: ${ott || "–"}.`;
      if (sw.vtpRevizio > forras.vtpRevizio) megj += ` ${c.eszkoz} revíziója nagyobb – ő írná felül a többieket!`;
      else if (sw.vtpRevizio === forras.vtpRevizio) megj += " Egyenlő revíziónál nincs átvétel: módosíts valamit a serveren (pl. hozz létre és törölj egy VLAN-t).";
      else megj += " A hirdetés nem ért ide: nézd meg a trunkokat, a tartománynevet, a jelszót és a köztes switch verzióját.";
      return { ok: false, megjegyzes: megj };
    },
    /** RIP-beállítás egy routeren: verzió, hálózatok, passzív interfészek, auto-summary, default route hirdetése. */
    rip(f, c) {
      const r = f.eszkoz(c.eszkoz);
      if (!r.rip) return { ok: false, megjegyzes: `${c.eszkoz}-en nem fut RIP.` };
      const hibak = [];
      if (c.verzio && r.rip.verzio !== c.verzio) hibak.push(`a verzió most ${r.rip.verzio || "nincs megadva (v1-et küld)"} (${c.verzio} kellene)`);
      for (const n of c.halozatok || []) {
        const o = ipSzoveg(osztalyos(ipSzam(n)).halozat);
        if (!r.rip.halozatok.includes(o)) hibak.push(`hiányzik a ${o} hálózat`);
      }
      for (const n of c.nemHalozatok || []) {
        const o = ipSzoveg(osztalyos(ipSzam(n)).halozat);
        if (r.rip.halozatok.includes(o)) hibak.push(`a ${o} hálózat nem kellene a RIP-be`);
      }
      for (const p of c.passziv || []) if (!r.rip.passziv.includes(p)) hibak.push(`${rovid3(p)} nem passzív`);
      if (c.autoSummary !== void 0 && r.rip.autoSummary !== c.autoSummary) {
        hibak.push(c.autoSummary ? "az automatikus összegzés ki van kapcsolva" : "az automatikus összegzés még be van kapcsolva");
      }
      if (c.alapUtvonal !== void 0 && r.rip.alapUtvonal !== c.alapUtvonal) {
        hibak.push(c.alapUtvonal ? "nem hirdeti az alapértelmezett útvonalat" : "hirdeti az alapértelmezett útvonalat, pedig nem kellene");
      }
      if (hibak.length) return { ok: false, megjegyzes: hibak.join("; ") + "." };
      const reszek = [`RIPv${r.rip.verzio || 1}`, `hálózatok: ${r.rip.halozatok.join(", ") || "–"}`];
      if (r.rip.passziv.length) reszek.push(`passzív: ${r.rip.passziv.map(rovid3).join(", ")}`);
      reszek.push(r.rip.autoSummary ? "auto-summary be" : "auto-summary ki");
      return { ok: true, megjegyzes: reszek.join(", ") + "." };
    },
    /** RIPng egy routeren: IPv6-továbbítás, mely interfészeken fut (és melyiken nem), default route hirdetése. */
    ripng(f, c) {
      const r = f.eszkoz(c.eszkoz);
      if (!r.ipv6Routing) return { ok: false, megjegyzes: `${c.eszkoz}-en nincs bekapcsolva az IPv6-továbbítás (unicast routing).` };
      const hibak = [];
      const port2 = (n) => r.portok.find((p) => p.nev === n);
      for (const n of c.interfeszek || []) if (!port2(n).ripng) hibak.push(`${rovid3(n)}: nincs rajta RIPng`);
      for (const n of c.nemInterfeszek || []) if (port2(n).ripng) hibak.push(`${rovid3(n)}: fut rajta RIPng, pedig nem kellene`);
      for (const [n, mit] of Object.entries(c.alapUtvonal || {})) {
        if (port2(n).ripngAlap !== mit) hibak.push(`${rovid3(n)}: nem hirdeti a ::/0-t (${mit})`);
      }
      if (hibak.length) return { ok: false, megjegyzes: hibak.join("; ") + "." };
      const be = r.portok.filter((p) => p.ripng).map((p) => rovid3(p.nev));
      return { ok: true, megjegyzes: `RIPng fut itt: ${be.join(", ") || "–"}.` };
    },
    /**
     * OSPF-folyamat egy routeren: { eszkoz, csalad?: 4|6, routerId, interfeszek, nemInterfeszek, terulet,
     * passziv, referencia, alapUtvonal }. A router ID a ténylegesen használt (nem csak a beírt) érték.
     */
    ospf(f, c) {
      const r = f.eszkoz(c.eszkoz);
      const cs = c.csalad || 4;
      const o = ospfBeall(r, cs);
      const nev = cs === 4 ? "OSPF" : "OSPFv3";
      if (!o) {
        if (c.nemInterfeszek && !c.interfeszek && !c.routerId) return { ok: true, megjegyzes: `${c.eszkoz}-en nem fut ${nev} – ahogy kell.` };
        return { ok: false, megjegyzes: `${c.eszkoz}-en nem fut ${nev}.` };
      }
      const a = ospfAllapot(r, cs);
      const hibak = [];
      if (c.routerId) {
        if (!a.fut) hibak.push(`a folyamat nem fut (nincs router ID)`);
        else if (a.rid !== c.routerId) {
          hibak.push(o.routerId === c.routerId ? `a router ID be van írva (${c.routerId}), de még a régi (${a.rid}) érvényes – újra kell indítani a folyamatot` : `a router ID most ${a.rid} (${c.routerId} kellene)`);
        }
      }
      for (const n of c.interfeszek || []) {
        const t = ospfTerulet(r, r.portok.find((p) => p.nev === n), cs);
        if (!t) hibak.push(`${rovid3(n)}: nincs az ${nev}-ben`);
        else if (c.terulet !== void 0 && t.terulet !== c.terulet) hibak.push(`${rovid3(n)}: a ${t.terulet}-s területben van (${c.terulet} kellene)`);
      }
      for (const n of c.nemInterfeszek || []) {
        if (ospfTerulet(r, r.portok.find((p) => p.nev === n), cs)) hibak.push(`${rovid3(n)}: fut rajta az ${nev}, pedig nem kellene`);
      }
      for (const n of c.passziv || []) if (!passzivE(r, r.portok.find((p) => p.nev === n), cs)) hibak.push(`${rovid3(n)} nem passzív`);
      if (c.referencia !== void 0 && o.referencia !== c.referencia) hibak.push(`a referencia-sávszélesség most ${o.referencia} (${c.referencia} kellene)`);
      if (c.alapUtvonal !== void 0 && !!o.alapUtvonal !== c.alapUtvonal) {
        hibak.push(c.alapUtvonal ? "nem hirdeti az alapértelmezett útvonalat" : "hirdeti az alapértelmezett útvonalat, pedig nem kellene");
      }
      if (hibak.length) return { ok: false, megjegyzes: hibak.join("; ") + "." };
      const be = r.portok.filter((p) => ospfTerulet(r, p, cs)).map((p) => rovid3(p.nev));
      return { ok: true, megjegyzes: `${nev}, router ID ${a.rid || "–"}, interfészek: ${be.join(", ") || "–"}.` };
    },
    /** Egy szomszédság: { eszkoz, szomszed (router ID), port?, allapot: 'FULL', szerep?: 'DR'|'BDR'|'DROTHER'|'-', csalad? } */
    "ospf-szomszed"(f, c) {
      const r = f.eszkoz(c.eszkoz);
      const cs = c.csalad || 4;
      const a = ospfAllapot(r, cs);
      if (!a.fut) return { ok: false, megjegyzes: `${c.eszkoz}-en nem fut ${cs === 4 ? "OSPF" : "OSPFv3"}.` };
      let talalt = null;
      for (const I2 of a.ifek) {
        if (c.port && I2.port !== c.port) continue;
        const n2 = I2.szomszedok.find((x) => x.rid === c.szomszed);
        if (n2) talalt = { I: I2, n: n2 };
      }
      if (!talalt) return { ok: false, megjegyzes: `${c.eszkoz} nem látja szomszédként a(z) ${c.szomszed} routert${c.port ? ` a(z) ${rovid3(c.port)} interfészen` : ""}.` };
      const { I, n } = talalt;
      const szerep = szomszedSzerep(I, n);
      const leiras = `${n.allapot}/${szerep}`;
      if (c.allapot && n.allapot !== c.allapot) return { ok: false, megjegyzes: `${c.eszkoz} – ${c.szomszed}: most ${leiras} (${c.allapot} kellene).` };
      if (c.szerep && szerep !== c.szerep) return { ok: false, megjegyzes: `${c.eszkoz} – ${c.szomszed}: most ${leiras} (${c.szerep === "-" ? "pont-pont link kellene" : `${c.szerep} kellene`}).` };
      return { ok: true, megjegyzes: `${c.eszkoz} – ${c.szomszed} (${rovid3(I.port)}): ${leiras}.` };
    },
    /**
     * Egy OSPF-interfész: { eszkoz, port, csalad?, halozatTipus: 'POINT_TO_POINT'|'BROADCAST', allapot: 'DR'|'BDR'|…,
     * koltseg, prioritas, hello, dead, hitelesites: 'md5', kulcs: { 1: 'jelszó' } }
     */
    "ospf-interfesz"(f, c) {
      const r = f.eszkoz(c.eszkoz);
      const cs = c.csalad || 4;
      const p = r.portok.find((x) => x.nev === c.port);
      const pb = cs === 4 ? p.ospf : p.ospf6;
      const a = ospfAllapot(r, cs);
      const I = a.ifek.find((x) => x.port === c.port);
      const hibak = [];
      if (c.halozatTipus && halozatTipus(p, cs) !== c.halozatTipus) hibak.push(`a hálózattípus most ${halozatTipus(p, cs)} (${c.halozatTipus} kellene)`);
      if (c.koltseg !== void 0 && koltseg(r, p, cs) !== c.koltseg) hibak.push(`a költség most ${koltseg(r, p, cs)} (${c.koltseg} kellene)`);
      if (c.prioritas !== void 0 && pb.prioritas !== c.prioritas) hibak.push(`a prioritás most ${pb.prioritas} (${c.prioritas} kellene)`);
      const idok = idokozok(p, cs);
      if (c.hello !== void 0 && idok.hello !== c.hello) hibak.push(`a Hello-idő most ${idok.hello} mp (${c.hello} kellene)`);
      if (c.dead !== void 0 && idok.dead !== c.dead) hibak.push(`a Dead-idő most ${idok.dead} mp (${c.dead} kellene)`);
      if (c.hitelesites && pb.hitelesites !== c.hitelesites) hibak.push(c.hitelesites === "md5" ? "nincs bekapcsolva az MD5-hitelesítés" : `a hitelesítés most: ${pb.hitelesites || "nincs"}`);
      for (const [k, v] of Object.entries(c.kulcs || {})) {
        if (pb.kulcsok[k] === void 0) hibak.push(`nincs ${k}-es MD5-kulcs`);
        else if (pb.kulcsok[k] !== v) hibak.push(`a(z) ${k}-es kulcs jelszava nem egyezik`);
      }
      if (c.allapot) {
        if (!I) hibak.push("az interfészen nem fut az OSPF (vagy le van kapcsolva)");
        else if (I.allapot !== c.allapot) hibak.push(`az interfész szerepe most ${I.allapot === "P2P" ? "pont-pont" : I.allapot} (${c.allapot} kellene)`);
      }
      if (hibak.length) return { ok: false, megjegyzes: `${c.eszkoz} ${rovid3(c.port)}: ${hibak.join("; ")}.` };
      const reszek = [halozatTipus(p, cs), `költség ${koltseg(r, p, cs)}`];
      if (I && I.tipus === "BROADCAST") reszek.push(`szerep ${I.allapot}`);
      if (pb.hitelesites === "md5") reszek.push("MD5");
      return { ok: true, megjegyzes: `${c.eszkoz} ${rovid3(c.port)}: ${reszek.join(", ")}.` };
    },
    /** IPv6-továbbítás be van-e kapcsolva. */
    "ipv6-routing"(f, c) {
      const r = f.eszkoz(c.eszkoz);
      return r.ipv6Routing ? { ok: true, megjegyzes: "Az IPv6-továbbítás be van kapcsolva." } : { ok: false, megjegyzes: `${c.eszkoz} nem továbbít IPv6-csomagokat (gyárilag ki van kapcsolva).` };
    },
    /**
     * Útvonal a routing táblában: { eszkoz, halozat: '172.16.3.0/24', kod?: 'R', port?: 'Serial0/1/0', nincs?: true }.
     * „nincs: true” – ellenpróba: ez az útvonal NE legyen a táblában.
     */
    utvonal(f, c) {
      const r = f.eszkoz(c.eszkoz);
      const e = bejegyzes(r, c.halozat);
      const jo = e && !e.lehetLe;
      if (c.nincs) {
        if (jo) return { ok: false, megjegyzes: `${c.eszkoz} táblájában ott van: ${e.kod} ${c.halozat} – pedig nem kellene.` };
        return { ok: true, megjegyzes: `${c.eszkoz} táblájában nincs ${c.halozat} – ahogy kell.` };
      }
      if (!jo) return { ok: false, megjegyzes: `${c.eszkoz} táblájában nincs ${c.halozat}${e && e.lehetLe ? " (csak „possibly down” állapotban)" : ""}.` };
      if (c.kod && e.kod !== c.kod) return { ok: false, megjegyzes: `${c.halozat} megvan, de ${e.kod} kódú (${c.kod} kellene).` };
      const utak = e.utak.map((u) => u.port || (u.kovetkezo !== null && u.kovetkezo !== void 0 ? kovSzoveg(u.kovetkezo) : "")).filter(Boolean);
      if (c.port && !e.utak.some((u) => u.port === c.port)) {
        return { ok: false, megjegyzes: `${c.halozat} most erre megy: ${utak.map(rovid3).join(", ")} (${rovid3(c.port)} felé kellene).` };
      }
      return { ok: true, megjegyzes: `${e.kod} ${c.halozat} [${e.ad}/${e.metrika}]${utak.length ? " – " + utak.map(rovid3).join(", ") : ""}` };
    },
    "pc-ip"(f, c) {
      const pc = f.eszkoz(c.eszkoz);
      if (!pc.ip) return { ok: false, megjegyzes: `${c.eszkoz}-nek még nincs IP-címe (kattints a gépre).` };
      const hibak = [];
      if (pc.ip !== c.ip) hibak.push(`IP-cím most: ${pc.ip} (${c.ip} kellene)`);
      if (pc.maszk !== c.maszk) hibak.push(`maszk most: ${pc.maszk || "nincs"} (${c.maszk} kellene)`);
      if (hibak.length) return { ok: false, megjegyzes: hibak.join("; ") + "." };
      return { ok: true, megjegyzes: `${pc.ip} / ${pc.maszk}` };
    }
  };
  function tervezettIp(f, nev) {
    const sor2 = (f.feladat.cimterv || []).find((s) => s.eszkoz === nev);
    return sor2 ? sor2.ip : f.eszkoz(nev).ip;
  }
  var PING_SZOVEG = {
    valasz: "Megjött a válasz.",
    idotullepes: "Nem jött válasz (Request timed out).",
    elerhetetlen: "Nem jött ARP-válasz: a cél nem érhető el ebben a szórási tartományban (Destination host unreachable).",
    hiba: "A ping el sem indult: nincs IP-cím, vagy a cél másik hálózatban van, és nincs alapértelmezett átjáró.",
    "halozat-elerhetetlen": "Egy router visszaszólt: nincs útvonala a célhálózat felé (Destination net unreachable).",
    "ttl-lejart": "Lejárt a TTL útközben (hurok?).",
    "ido-lejart": "Lejárt a TTL útközben (hurok?)."
  };
  function egyProbaPing(f, honnan, ip, cb) {
    const e = f.eszkoz(honnan);
    if (e.tipus === "router") {
      routerPing(f.halozat, e, ip, (v) => cb(v.fajta === "elerhetetlen" ? { ...v, fajta: "halozat-elerhetetlen" } : v));
    } else {
      egyPing(f.halozat, e, ip, cb);
    }
  }
  var PROBA_CELOK = {
    /**
     * ping { honnan, cel (a címterv szerinti gép) vagy ip, vart: true|false, db: hány pingnek kell sikerülnie }
     * Ha routerek is vannak, előtte „bemelegítő” pingek mennek (nem számítanak): az első csomagok
     * gyakran elvesznek, amíg a routerek ARP-pal megkeresik a következő ugrást.
     */
    ping(f, c, kesz) {
      const ip = c.ip || tervezettIp(f, c.cel);
      const db = c.db || 1;
      const vart = c.vart !== false;
      const eredmenyek = [];
      let bemelegites = f.halozat.eszkozok.some((x) => x.tipus === "router") ? 3 : 0;
      let elment = bemelegites === 0;
      const kovetkezo = () => {
        egyProbaPing(f, c.honnan, ip, (e) => {
          if (bemelegites > 0) {
            if (e.fajta === "valasz") elment = true;
            bemelegites = e.fajta === "idotullepes" ? bemelegites - 1 : 0;
            return f.halozat.ora.utemez(1, kovetkezo);
          }
          eredmenyek.push(e);
          const kell = elment || e.fajta === "valasz" ? db : 1;
          if (eredmenyek.length < kell) return f.halozat.ora.utemez(1, kovetkezo);
          const sikeres = eredmenyek.filter((x) => x.fajta === "valasz").length;
          const ok = vart ? sikeres === db && eredmenyek.length === db : sikeres === 0;
          const rossz = eredmenyek.find((x) => x.fajta === "valasz" !== vart) || eredmenyek[0];
          let megjegyzes = `${c.honnan} → ${ip}: `;
          if (eredmenyek.length > 1) megjegyzes += `${eredmenyek.length} pingből ${sikeres} sikerült. `;
          megjegyzes += PING_SZOVEG[rossz.fajta] || rossz.fajta;
          if (rossz.kitol && rossz.fajta !== "valasz") megjegyzes += ` (${rossz.kitol})`;
          if (!vart && sikeres) megjegyzes += " Pedig ennek nem szabadna sikerülnie!";
          if (vart && eredmenyek.length > 1 && sikeres > 0 && sikeres < eredmenyek.length) megjegyzes += " Hol megy, hol nem – nézd meg, nincs-e két út ugyanoda.";
          kesz({ ok, megjegyzes });
        });
      };
      kovetkezo();
    },
    szoras(f, c, kesz) {
      szorasProba(f.halozat, f.eszkoz(c.honnan), (kik) => {
        const nevek = c.elerje.concat(c.neErje);
        const elerte = nevek.filter((n) => kik.includes(f.eszkoz(n)));
        const hianyzik = (c.elerje || []).filter((n) => !elerte.includes(n));
        const tilos = (c.neErje || []).filter((n) => elerte.includes(n));
        const reszek = [`Eljutott ide: ${elerte.length ? elerte.join(", ") : "senkihez"}.`];
        if (hianyzik.length) reszek.push(`Nem jutott el ide, pedig kellene: ${hianyzik.join(", ")}.`);
        if (tilos.length) reszek.push(`Ide nem szabadna eljutnia (más VLAN): ${tilos.join(", ")}.`);
        kesz({ ok: hianyzik.length === 0 && tilos.length === 0, megjegyzes: reszek.join(" ") });
      });
    }
  };
  function allapotCel(f, c) {
    const fn = ALLAPOT_CELOK[c.tipus];
    return fn ? fn(f, c) : null;
  }
  function probaE(cel) {
    return !!PROBA_CELOK[cel.tipus];
  }
  function ellenoriz(f, { indul = () => {
  }, lepes = () => {
  }, kesz = () => {
  }, szunet = 0 } = {}) {
    const celok = f.feladat.celok;
    const eredmenyek = new Array(celok.length).fill(null);
    const probak = [];
    celok.forEach((c, i) => {
      if (ALLAPOT_CELOK[c.tipus]) {
        eredmenyek[i] = ALLAPOT_CELOK[c.tipus](f, c);
        lepes(i, eredmenyek[i]);
      } else if (PROBA_CELOK[c.tipus]) {
        probak.push(i);
      } else {
        throw new Error(`Ismeretlen céltípus: ${c.tipus}`);
      }
    });
    const kovetkezo = (k) => {
      if (k >= probak.length) return kesz(eredmenyek);
      const i = probak[k];
      indul(i);
      PROBA_CELOK[celok[i].tipus](f, celok[i], (e) => {
        eredmenyek[i] = e;
        lepes(i, e);
        f.halozat.ora.utemez(szunet, () => kovetkezo(k + 1));
      });
    };
    kovetkezo(0);
    return eredmenyek;
  }

  // src/feladat/vezetett.js
  var MOD_SZINT = { felhasznalo: 0, priv: 1, konfig: 2 };
  function modSzint(mod) {
    return mod in MOD_SZINT ? MOD_SZINT[mod] : 3;
  }
  var ATMENETI = ["kivalasztva", "mod", "parancs"];
  function atmeneti(lepes) {
    const k = Array.isArray(lepes.kesz) ? lepes.kesz : [lepes.kesz];
    return k.every((c) => ATMENETI.includes(c.tipus));
  }
  function parancsIllik(sor2, szavak) {
    let t = String(sor2 || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (t[0] === "do" && szavak[0] !== "do") t = t.slice(1);
    if (t.length < szavak.length) return false;
    return szavak.every((sz, i) => sz.toLowerCase().startsWith(t[i]) || t[i] === sz.toLowerCase());
  }
  var Vezeto = class {
    /**
     * @param {Object[]} lepesek – a feladat „bemutato” mezője (már a változat értékeivel)
     * @param {Object} k – a környezet:
     *   f: a betöltött feladat; valasztott(): a kiválasztott eszköz neve;
     *   munkamenet(nev): az eszköz parancssori munkamenete; utolsoParancs(nev): az utolsó beírt sor;
     *   ellenorzesKesz(): igaz, ha az utolsó Ellenőrzés hibátlan volt;
     *   foglalt(nev) (nem kötelező): az eszköz terminálja éppen ír (pl. fut a ping)
     */
    constructor(lepesek, k) {
      this.lepesek = lepesek;
      this.k = k;
      this.index = 0;
    }
    /** Az aktuális lépés (vagy null, ha a bemutató végére értünk). */
    aktualis() {
      return this.index < this.lepesek.length ? this.lepesek[this.index] : null;
    }
    vege() {
      return this.index >= this.lepesek.length;
    }
    /** Egy feltétel teljesül-e. */
    feltetel(c) {
      const k = this.k;
      switch (c.tipus) {
        case "kivalasztva":
          return k.valasztott() === c.eszkoz;
        case "mod": {
          const mm = k.munkamenet(c.eszkoz);
          if (!mm || mm.mod === void 0) return false;
          if (modSzint(mm.mod) < modSzint(c.mod)) return false;
          if (c.port) return modSzint(mm.mod) === 3 && (mm.kontextus.portok || []).includes(c.port);
          return true;
        }
        case "parancs":
          return parancsIllik(k.utolsoParancs(c.eszkoz), c.szavak) && !(k.foglalt && k.foglalt(c.eszkoz));
        case "ellenorzes":
          return !!k.ellenorzesKesz();
        default: {
          const e = allapotCel(k.f, c);
          return !!(e && e.ok);
        }
      }
    }
    /** A lépés teljesült-e (több feltételnél mindegyiknek teljesülnie kell). */
    kesz(lepes) {
      const k = Array.isArray(lepes.kesz) ? lepes.kesz : [lepes.kesz];
      return k.every((c) => this.feltetel(c));
    }
    /**
     * Továbblépés, amíg a lépések teljesülnek. Visszaadja, hogy változott-e az aktuális lépés.
     * @returns {boolean}
     */
    frissit() {
      const regi = this.index;
      for (; ; ) {
        const l = this.aktualis();
        if (!l) break;
        if (this.kesz(l)) {
          this.index++;
          continue;
        }
        if (atmeneti(l)) {
          let j = this.index + 1;
          while (j < this.lepesek.length && atmeneti(this.lepesek[j])) j++;
          if (j < this.lepesek.length && this.kesz(this.lepesek[j])) {
            this.index = j + 1;
            continue;
          }
        }
        break;
      }
      return this.index !== regi;
    }
    /** A lépés kihagyása (a tanuló „Tovább” gombja). */
    kihagy() {
      if (!this.vege()) this.index++;
    }
    /** Vissza az előző lépéshez. */
    vissza() {
      if (this.index > 0) this.index--;
    }
  };

  // src/cli/pc-munkamenet.js
  var PROMPT = "C:\\>";
  var PcMunkamenet = class {
    /**
     * @param {{eszkoz: Object, halozat: import('../mag/halozat.js').Halozat}} p
     */
    constructor({ eszkoz, halozat }) {
      this.eszkoz = eszkoz;
      this.halozat = halozat;
      this.lista = [];
      this.figyelok = [];
      this.sugoBillentyu = false;
      this.vanCtrlZ = false;
      this.vanTab = false;
    }
    figyel(fn) {
      this.figyelok.push(fn);
    }
    prompt() {
      return PROMPT;
    }
    tortenet() {
      return this.lista;
    }
    sugo(sor2) {
      return { kimenet: [], sor: sor2 };
    }
    kiegeszit() {
      return null;
    }
    ctrlZ() {
      return { kimenet: [] };
    }
    /**
     * @param {string} sor
     * @returns {{kimenet: Array<string|{varj:number}|{folyamat: Function}|{torles: true}>, lapozhato: boolean}}
     */
    bevitel(sor2) {
      const kimenet = [];
      const s = sor2.trim();
      if (s === "") return { kimenet, lapozhato: false };
      if (this.lista[this.lista.length - 1] !== s) this.lista.push(s);
      while (this.lista.length > TORTENET_MERET * 2) this.lista.shift();
      const szavak = s.split(/\s+/);
      const parancs = szavak[0].toLowerCase();
      const arg = szavak.slice(1);
      if (parancs === "ping") kimenet.push(...this.ping(arg));
      else if (parancs === "tracert") kimenet.push(...this.tracert(arg));
      else if (parancs === "ipconfig") kimenet.push(...this.ipconfig(arg));
      else if (parancs === "arp") kimenet.push(...this.arp(arg));
      else if (parancs === "hostname") kimenet.push(this.eszkoz.hostname, "");
      else if (parancs === "cls") kimenet.push({ torles: true });
      else if (parancs === "help" || parancs === "?" || parancs === "/?") kimenet.push(...sugoSzoveg());
      else {
        kimenet.push(
          `'${szavak[0]}' is not recognized as an internal or external command,`,
          "operable program or batch file.",
          "",
          "[Szimulátor] A gépen használható parancsok: ping, tracert, ipconfig, arp -a, hostname, cls, help",
          ""
        );
      }
      for (const fn of this.figyelok) fn();
      return { kimenet, lapozhato: false };
    }
    /** @private */
    ping(arg) {
      let db = 4;
      let cel = null;
      for (let i = 0; i < arg.length; i++) {
        const a = arg[i].toLowerCase();
        if (a === "-n" || a === "/n") {
          const n = Number(arg[++i]);
          if (!Number.isInteger(n) || n < 1 || n > 100) {
            return ["Bad value for option -n, valid range is from 1 to 100.", ""];
          }
          db = n;
        } else if (a.startsWith("-") || a.startsWith("/")) {
          return [`Bad option ${arg[i]}.`, "", ...pingHasznalat()];
        } else {
          cel = arg[i];
        }
      }
      if (cel === null) return pingHasznalat();
      if (!ervenyesIp(cel) && !ipv6Normal(cel)) {
        return [`Ping request could not find host ${cel}. Please check the name and try again.`, ""];
      }
      const v6 = !ervenyesIp(cel);
      if (v6) cel = ipv6Normal(cel).toLowerCase();
      return ["", `Pinging ${cel} with 32 bytes of data:`, { folyamat: (kiir, kesz) => this.pingFolyamat(cel, db, kiir, kesz) }];
    }
    /** @private – a ping válaszai egyenként, ahogy megérkeznek */
    pingFolyamat(cel, db, kiir, kesz) {
      const h = this.halozat;
      const pc = this.eszkoz;
      const v6 = cel.includes(":");
      let elkuldve = 0;
      let fogadva = 0;
      const idok = [];
      const fajtak = [];
      const ido = (ms) => ms ? `=${ms}ms` : "<1ms";
      const egy = () => {
        if (elkuldve >= db) return vege();
        elkuldve++;
        egyPing(h, pc, cel, (e) => {
          fajtak.push(e);
          let szunet = 1e3;
          if (e.fajta === "valasz") {
            kiir(v6 ? `Reply from ${cel}: time${ido(e.keses)}` : `Reply from ${cel}: bytes=32 time${ido(e.keses)} TTL=${e.ttl}`);
            fogadva++;
            idok.push(e.keses || 0);
          } else if (e.fajta === "idotullepes") {
            kiir("Request timed out.");
            szunet = 0;
          } else if (e.fajta === "elerhetetlen") {
            kiir(`Reply from ${v6 ? (pc.ipv6 || pcLinkLocal(pc)).toLowerCase() : pc.ip}: Destination host unreachable.`);
            fogadva++;
            szunet = 0;
          } else if (e.fajta === "halozat-elerhetetlen") {
            kiir(`Reply from ${v6 ? e.kitol.toLowerCase() : e.kitol}: Destination net unreachable.`);
            fogadva++;
          } else if (e.fajta === "ttl-lejart") {
            kiir(`Reply from ${v6 ? e.kitol.toLowerCase() : e.kitol}: TTL expired in transit.`);
            fogadva++;
          } else {
            kiir("PING: transmit failed. General failure. ");
            szunet = 500;
          }
          if (elkuldve >= db) return vege();
          h.ora.utemez(szunet, egy);
        });
      };
      const vege = () => {
        const elveszett = elkuldve - fogadva;
        kiir("");
        kiir(`Ping statistics for ${cel}:`);
        kiir(`    Packets: Sent = ${elkuldve}, Received = ${fogadva}, Lost = ${elveszett} (${Math.round(elveszett / elkuldve * 100)}% loss),`);
        if (idok.length > 0) {
          const atl = Math.round(idok.reduce((a, b) => a + b, 0) / idok.length);
          kiir("Approximate round trip times in milli-seconds:");
          kiir(`    Minimum = ${Math.min(...idok)}ms, Maximum = ${Math.max(...idok)}ms, Average = ${atl}ms`);
        }
        kiir("");
        for (const m of this.magyarazat(cel, fajtak)) kiir(m);
        kesz();
      };
      egy();
    }
    /** @private – rövid magyarázat a sikertelen pinghez (a szimulátor saját megjegyzése) */
    magyarazat(cel, eredmenyek) {
      const pc = this.eszkoz;
      const fajtak = new Set(eredmenyek.map((e) => e.fajta));
      const v6 = cel.includes(":");
      const m = [];
      if (fajtak.has("hiba")) {
        if (v6 && !vanIpv6(pc)) m.push("[Szimulátor] Ennek a gépnek még nincs IPv6-címe (kattints a beállításokra fent).");
        else if (!v6 && !vanIp(pc)) m.push("[Szimulátor] Ennek a gépnek még nincs IP-címe vagy maszkja (kattints a beállításokra fent).");
        else if (!pc.portok[0].fent) m.push("[Szimulátor] Nincs link: a gép kábele egy lekapcsolt portra csatlakozik.");
        else if (!kovetkezoUgras(pc, v6 ? ipv6Normal(cel) : cel)) {
          m.push("[Szimulátor] A cél másik hálózatban van, és nincs alapértelmezett átjáró, ezért a csomag el sem indul.");
        }
      }
      if (fajtak.has("elerhetetlen")) {
        m.push(v6 ? "[Szimulátor] A „Destination host unreachable” a saját gépedtől jön: senki nem válaszolt a szomszédkérdésre (ND)." : "[Szimulátor] A „Destination host unreachable” a saját gépedtől jön: senki nem válaszolt az ARP-kérdésre, hogy kié ez a cím. A gép ezt is „Received”-nek számolja.");
      }
      const nincsUt = eredmenyek.find((e) => e.fajta === "halozat-elerhetetlen");
      if (nincsUt) {
        m.push(`[Szimulátor] A „Destination net unreachable” a(z) ${nincsUt.kitol} routertől jött: nincs útvonala a célhálózat felé (nézd meg a routing tábláját: show ip route).`);
      }
      const elso = eredmenyek.findIndex((e) => e.fajta !== "idotullepes");
      const elsoElveszett = elso > 0 && eredmenyek.slice(elso).every((e) => e.fajta === "valasz");
      if (elsoElveszett) {
        m.push(`[Szimulátor] ${elso === 1 ? "Az első csomag elveszett" : "Az első csomagok elvesztek"}, a többi átment: útközben egy router még nem ismerte a következő ugrás MAC-címét. Ilyenkor ${v6 ? "szomszédkérdést (ND)" : "ARP-kérdést"} küld, az éppen továbbítandó csomagot pedig eldobja.`);
      }
      if (m.length) m.push("");
      return m;
    }
    /** @private – tracert: ugrásonként 3 próba egyre nagyobb TTL-lel */
    tracert(arg) {
      const cel0 = arg.find((a) => !a.startsWith("-") && !a.startsWith("/"));
      if (!cel0) return ["", "Usage: tracert target_name", "", "[Szimulátor] Példa: tracert 172.16.3.10", ""];
      if (!ervenyesIp(cel0) && !ipv6Normal(cel0)) return [`Unable to resolve target system name ${cel0}.`, ""];
      const v6 = !ervenyesIp(cel0);
      const cel = v6 ? ipv6Normal(cel0).toLowerCase() : cel0;
      return ["", `Tracing route to ${cel} over a maximum of 30 hops`, "", {
        folyamat: (kiir, kesz) => this.tracertFolyamat(cel, kiir, kesz)
      }];
    }
    /** @private */
    tracertFolyamat(cel, kiir, kesz) {
      const h = this.halozat;
      const pc = this.eszkoz;
      const v6 = cel.includes(":");
      let ttl = 1;
      let ures = 0;
      const oszlop = (e) => {
        if (e.fajta === "idotullepes" || e.fajta === "hiba" || e.fajta === "elerhetetlen") return "    *    ";
        return (e.keses ? `${e.keses} ms` : "<1 ms").padStart(9);
      };
      const ugras = () => {
        const valaszok = [];
        const egy = () => {
          egyPing(h, pc, cel, (e) => {
            valaszok.push(e);
            if (valaszok.length < 3 && e.fajta !== "hiba") return h.ora.utemez(1, egy);
            return sorKesz();
          }, { ttl });
        };
        const sorKesz = () => {
          const sor2 = String(ttl).padStart(3);
          if (valaszok[0].fajta === "hiba") {
            kiir("Unable to contact IP driver. General failure.");
            kiir("");
            return kesz();
          }
          const ki = valaszok.find((e) => e.kitol);
          const halozat = valaszok.find((e) => e.fajta === "halozat-elerhetetlen");
          if (halozat) {
            kiir(`${sor2}  ${v6 ? halozat.kitol.toLowerCase() : halozat.kitol}  reports: Destination net unreachable.`);
            kiir("");
            kiir("Trace complete.");
            kiir("");
            return kesz();
          }
          const cimek = valaszok.map(oszlop).join("");
          if (!ki) {
            kiir(`${sor2}${cimek}  Request timed out.`);
            ures++;
          } else {
            kiir(`${sor2}${cimek}  ${v6 ? ki.kitol.toLowerCase() : ki.kitol}`);
            ures = 0;
          }
          if (valaszok.some((e) => e.fajta === "valasz") || ttl >= 30) {
            kiir("");
            kiir("Trace complete.");
            kiir("");
            return kesz();
          }
          if (ures >= 5) {
            kiir("");
            kiir("[Szimulátor] Több ugrás óta nem jön válasz – a valódi gép 30 ugrásig próbálkozna (megszakítás: Ctrl+C).");
            kiir("");
            return kesz();
          }
          ttl++;
          ugras();
        };
        egy();
      };
      ugras();
    }
    /** @private */
    ipconfig(arg) {
      const pc = this.eszkoz;
      const minden = arg.some((a) => a.toLowerCase() === "/all");
      if (arg.length && !minden) return ["", `Error: unrecognized or incomplete command line.`, "", "[Szimulátor] Használat: ipconfig vagy ipconfig /all", ""];
      const s = [""];
      if (minden) s.push(`   Host Name . . . . . . . . . . . . : ${pc.hostname}`, "");
      s.push("Ethernet adapter FastEthernet0:", "");
      if (!pc.portok[0].fent) {
        s.push("   Media State . . . . . . . . . . . : Media disconnected");
      }
      s.push("   Connection-specific DNS Suffix  . :");
      if (minden) s.push(`   Physical Address. . . . . . . . . : ${macKotojeles(pc.mac)}`);
      const v6 = vanIpv6(pc) || !!pc.ipv6Atjaro;
      if (v6 && pc.ipv6) s.push(`   IPv6 Address. . . . . . . . . . . : ${pc.ipv6.toLowerCase()}`);
      if (v6) s.push(`   Link-local IPv6 Address . . . . . : ${pcLinkLocal(pc).toLowerCase()}`);
      s.push(`   IPv4 Address. . . . . . . . . . . : ${pc.ip || "0.0.0.0"}`);
      s.push(`   Subnet Mask . . . . . . . . . . . : ${pc.maszk || "0.0.0.0"}`);
      if (v6 && pc.ipv6Atjaro) {
        s.push(`   Default Gateway . . . . . . . . . : ${pc.ipv6Atjaro.toLowerCase()}`);
        if (pc.atjaro) s.push(`                                       ${pc.atjaro}`);
      } else {
        s.push(`   Default Gateway . . . . . . . . . : ${pc.atjaro}`.trimEnd());
      }
      s.push("");
      return s;
    }
    /** @private */
    arp(arg) {
      const pc = this.eszkoz;
      const kapcsolo = (arg[0] || "").toLowerCase();
      if (kapcsolo === "-a" || kapcsolo === "-g") {
        const sorok = Object.entries(pc.arpTabla);
        if (sorok.length === 0) return ["No ARP Entries Found.", ""];
        const s = ["", `Interface: ${pc.ip || "0.0.0.0"} --- 0x2`, "  Internet Address      Physical Address      Type"];
        for (const [ip, b] of sorok) s.push(`  ${ip.padEnd(22)}${macKotojeles(b.mac).toLowerCase().padEnd(22)}dynamic`);
        s.push("");
        return s;
      }
      if (kapcsolo === "-d") {
        pc.arpTabla = {};
        return [""];
      }
      return ["", "[Szimulátor] Használat: arp -a (az ARP-gyorstár kiírása), arp -d (törlése)", ""];
    }
  };
  function pingHasznalat() {
    return [
      "",
      "Usage: ping [-n count] target_name",
      "",
      "[Szimulátor] Példa: ping 192.168.10.13 (a -n után megadható, hány csomagot küldjön; alapból 4)",
      ""
    ];
  }
  function sugoSzoveg() {
    return [
      "",
      "[Szimulátor] A gépen használható parancsok:",
      "[Szimulátor]   ping <IP-cím>      – elér-e egy másik gépet (ping -n 2 … = csak 2 csomag; IPv6-címmel is)",
      "[Szimulátor]   tracert <IP-cím>   – merre, mely routereken át jut el a csomag a célig",
      "[Szimulátor]   ipconfig           – a gép IP-beállításai (ipconfig /all: MAC-címmel együtt)",
      "[Szimulátor]   arp -a             – az ARP-gyorstár: melyik IP-címhez melyik MAC tartozik",
      "[Szimulátor]   arp -d             – az ARP-gyorstár törlése",
      "[Szimulátor]   hostname           – a gép neve",
      "[Szimulátor]   cls                – a képernyő törlése",
      ""
    ];
  }

  // src/nezet/pc-ablak.js
  function elem3(tag, osztaly, szoveg) {
    const e = document.createElement(tag);
    if (osztaly) e.className = osztaly;
    if (szoveg !== void 0) e.textContent = szoveg;
    return e;
  }
  function maszkAlak(szoveg) {
    const m = /^\/?(\d{1,2})$/.exec(szoveg.trim());
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 32) return szoveg.trim();
    const n = Number(m[1]);
    return ipSzoveg(n === 32 ? 4294967295 : ~((1 << 32 - n) - 1) >>> 0);
  }
  var PcAblak = class {
    /**
     * @param {HTMLElement} szulo
     * @param {{eszkoz: Object, halozat: Object, valtozott?: () => void, parancsUtan?: (sor: string) => void,
     *          ipv6?: boolean, atjaroKell?: boolean}} p
     *   ipv6: legyenek-e IPv6-mezők; atjaroKell: a feladatban kell-e átjáró (a mező mintaszövegéhez)
     */
    constructor(szulo, { eszkoz, halozat, valtozott: valtozott3 = () => {
    }, parancsUtan, ipv6 = false, atjaroKell = false }) {
      this.pc = eszkoz;
      this.valtozott = valtozott3;
      this.doboz = elem3("section", "hsz-pc-ablak");
      this.doboz.setAttribute("aria-label", `${eszkoz.hostname} – IP-beállítások és parancssor`);
      const urlap = elem3("form", "hsz-pc-urlap");
      this.urlap = urlap;
      urlap.noValidate = true;
      const cim = elem3("h3", "hsz-pc-urlap__cim", "IP-beállítások");
      urlap.append(cim);
      this.mezok = {
        ip: this.mezo(urlap, "IP-cím", "pl. 192.168.10.11"),
        maszk: this.mezo(urlap, "Alhálózati maszk", "pl. 255.255.255.0"),
        atjaro: this.mezo(urlap, "Alapértelmezett átjáró", atjaroKell ? "a router címe" : "most nem kell")
      };
      if (ipv6) {
        this.mezok.ipv6 = this.mezo(urlap, "IPv6-cím / előtag", "pl. 2001:DB8:1::10/64");
        this.mezok.ipv6Atjaro = this.mezo(urlap, "IPv6-átjáró", "pl. FE80::1");
        this.mezok.ipv6.inputMode = "text";
        this.mezok.ipv6Atjaro.inputMode = "text";
      }
      const sor2 = elem3("div", "hsz-pc-urlap__gombsor");
      const mentes2 = elem3("button", "hsz-gomb", "Mentés");
      mentes2.type = "submit";
      this.uzenet = elem3("span", "hsz-pc-urlap__uzenet");
      this.uzenet.setAttribute("role", "status");
      sor2.append(mentes2, this.uzenet);
      urlap.append(sor2);
      urlap.addEventListener("submit", (e) => {
        e.preventDefault();
        this.ment();
      });
      this.terminalHely = elem3("div", "hsz-pc-ablak__terminal");
      this.doboz.append(urlap, this.terminalHely);
      szulo.append(this.doboz);
      this.munkamenet = new PcMunkamenet({ eszkoz, halozat });
      this.terminal = new Terminal(this.terminalHely, this.munkamenet, { parancsUtan });
      this.terminal.cim(`${eszkoz.hostname} – parancssor`);
      this.betolt();
    }
    /** @private */
    mezo(urlap, felirat, pelda) {
      const l = elem3("label", "hsz-pc-urlap__mezo");
      const t = elem3("span", "", felirat);
      const i = elem3("input");
      Object.assign(i, { type: "text", inputMode: "decimal", autocomplete: "off", spellcheck: false, placeholder: pelda });
      l.append(t, i);
      urlap.append(l);
      return i;
    }
    /** Az aktuális beállítás a mezőkbe. */
    betolt() {
      this.mezok.ip.value = this.pc.ip;
      this.mezok.maszk.value = this.pc.maszk;
      this.mezok.atjaro.value = this.pc.atjaro;
      if (this.mezok.ipv6) {
        this.mezok.ipv6.value = this.pc.ipv6 ? `${this.pc.ipv6}/${this.pc.ipv6Hossz || 64}` : "";
        this.mezok.ipv6Atjaro.value = this.pc.ipv6Atjaro || "";
      }
    }
    /** @private */
    jelez(szoveg, hiba, mezo) {
      this.uzenet.textContent = szoveg;
      this.uzenet.classList.toggle("hsz-pc-urlap__uzenet--hiba", !!hiba);
      for (const m of Object.values(this.mezok)) m.removeAttribute("aria-invalid");
      if (mezo) {
        mezo.setAttribute("aria-invalid", "true");
        mezo.focus();
      }
    }
    /** @private – ellenőrzés és mentés */
    ment() {
      const ip = this.mezok.ip.value.trim();
      const maszk = maszkAlak(this.mezok.maszk.value);
      const atjaro = this.mezok.atjaro.value.trim();
      this.mezok.maszk.value = maszk;
      const v6 = {};
      if (this.mezok.ipv6) {
        const szoveg = this.mezok.ipv6.value.trim();
        const gw = this.mezok.ipv6Atjaro.value.trim();
        if (szoveg === "") {
          v6.ipv6 = "";
        } else {
          const [cim, hossz = "64"] = szoveg.split("/");
          const c = ipv6Elemez(cim);
          const h = Number(hossz);
          if (!c || !/^\d{1,3}$/.test(hossz) || h < 1 || h > 128) return this.jelez("Érvénytelen IPv6-cím (pl. 2001:DB8:1::10/64).", true, this.mezok.ipv6);
          if (linkLocalE(c) || csoportcimE(c)) return this.jelez("Ide globális IPv6-cím kell (a link-local címet a gép magától kapja).", true, this.mezok.ipv6);
          v6.ipv6 = ipv6Normal(cim);
          v6.ipv6Hossz = h;
        }
        if (gw !== "" && !ipv6Elemez(gw)) return this.jelez("Érvénytelen IPv6-átjáró (pl. FE80::1).", true, this.mezok.ipv6Atjaro);
        v6.ipv6Atjaro = gw === "" ? "" : ipv6Normal(gw);
      }
      if (ip === "" && maszk === "" && atjaro === "") {
        ipBeallit(this.pc, { ip: "", maszk: "", atjaro: "", ...v6 });
        this.jelez(v6.ipv6 ? "Mentve (IPv4-cím nélkül)." : "A beállítás törölve.");
        return this.valtozott();
      }
      if (!ervenyesIp(ip)) return this.jelez("Érvénytelen IP-cím (négy 0–255 közötti szám, ponttal elválasztva).", true, this.mezok.ip);
      if (maszk === "") return this.jelez("Add meg az alhálózati maszkot is.", true, this.mezok.maszk);
      const hiba = gepcimHiba(ip, maszk);
      if (hiba) return this.jelez(hiba, true, /maszk/.test(hiba) ? this.mezok.maszk : this.mezok.ip);
      if (atjaro !== "" && !ervenyesIp(atjaro)) return this.jelez("Érvénytelen átjárócím.", true, this.mezok.atjaro);
      ipBeallit(this.pc, { ip, maszk, atjaro, ...v6 });
      if (atjaro !== "" && !egyHalozat(ip, atjaro, maszk)) {
        this.jelez("Mentve – de figyelem: az átjáró nincs a gép hálózatában, így nem használható.");
      } else {
        this.jelez("Mentve.");
      }
      this.valtozott();
    }
    /** Megjelenítés / elrejtés. */
    mutat(lathato) {
      this.doboz.hidden = !lathato;
      if (lathato) this.betolt();
    }
  };

  // src/nezet/panel.js
  function elem4(tag, osztaly, szoveg) {
    const e = document.createElement(tag);
    if (osztaly) e.className = osztaly;
    if (szoveg !== void 0) e.textContent = szoveg;
    return e;
  }
  function szovegbe2(cel, szoveg) {
    String(szoveg).split("`").forEach((resz, i) => {
      if (resz === "") return;
      cel.append(i % 2 === 1 ? elem4("code", "hsz-kod", resz) : document.createTextNode(resz));
    });
    return cel;
  }
  function lepesAlak(l) {
    if (typeof l === "string") return { cel: l, parancsok: "", tippek: [] };
    return { cel: l.cel || "", parancsok: l.parancsok || "", tippek: l.tippek || [] };
  }
  function idoSzoveg(ms) {
    const mp = Math.floor(ms / 1e3);
    const k = (n) => String(n).padStart(2, "0");
    const ora = Math.floor(mp / 3600);
    return ora ? `${ora}:${k(Math.floor(mp % 3600 / 60))}:${k(mp % 60)}` : `${k(Math.floor(mp / 60))}:${k(mp % 60)}`;
  }
  var MODOK2 = {
    oktato: { nev: "Oktató", leiras: "Lépésről lépésre, a parancsokkal és magyarázattal." },
    gyakorlo: { nev: "Gyakorló", leiras: "Csak a cél látszik; ha elakadsz, kérj tippet." },
    vizsga: { nev: "Vizsga", leiras: "Önellenőrzés: nincs parancs, nincs tipp; az idő mérődik, a végén Beadás." }
  };
  var PROBA_SZUNET = 500;
  var FeladatPanel = class {
    /**
     * @param {HTMLElement} szulo
     * @param {import('../feladat/betolto.js').BetoltottFeladat} f
     * @param {{mod?: 'oktato'|'gyakorlo'|'vizsga', most?: () => number, valtozatLink?: () => string,
     *          bemutato?: () => void, ellenorzesUtan?: () => void}} [beallitasok]
     */
    constructor(szulo, f, beallitasok = {}) {
      this.f = f;
      this.mod = MODOK2[beallitasok.mod] ? beallitasok.mod : "oktato";
      this.most = beallitasok.most || (() => typeof performance !== "undefined" ? performance.now() : Date.now());
      this.vizsga = this.mod === "vizsga";
      this.beallitasok = beallitasok;
      this.feloldva = !this.vizsga;
      this.tippekSzama = 0;
      this.beadasok = 0;
      this.kezdes = this.most();
      this.vegeIdo = null;
      const fd = f.feladat;
      this.doboz = elem4("section", `hsz-panel hsz-panel--${this.mod}`);
      this.doboz.setAttribute("aria-label", "Feladat");
      const fej = elem4("div", "hsz-panel__fej");
      fej.append(elem4("h2", "hsz-panel__cim", fd.cim));
      if (fd.szint) fej.append(elem4("span", "hsz-panel__szint", fd.szint));
      fej.append(elem4("span", `hsz-panel__mod hsz-panel__mod--${this.mod}`, `${MODOK2[this.mod].nev} mód`));
      this.doboz.append(fej);
      this.doboz.append(elem4("p", "hsz-panel__modleiras", MODOK2[this.mod].leiras));
      if (fd.mag !== null && fd.mag !== void 0) this.doboz.append(valtozatSor(fd.mag, beallitasok.valtozatLink));
      if (this.vizsga) {
        this.ora = elem4("p", "hsz-panel__ora");
        this.ora.setAttribute("aria-live", "off");
        this.doboz.append(this.ora);
        this.oraFrissit();
        this.oraIdozito = setInterval(() => this.oraFrissit(), 1e3);
      }
      for (const bek of fd.leiras || []) this.doboz.append(szovegbe2(elem4("p", "hsz-panel__szoveg"), bek));
      this.lepesSorok = [];
      if (fd.lepesek && fd.lepesek.length) {
        this.doboz.append(elem4("h3", "hsz-panel__alcim", this.vizsga ? "Követelmények" : "Teendők"));
        const ol = elem4("ol", "hsz-panel__lepesek");
        for (const nyers of fd.lepesek) ol.append(this.lepesSor(lepesAlak(nyers)));
        this.doboz.append(ol);
      }
      if (fd.cimterv && fd.cimterv.length) this.doboz.append(...cimtervTabla(fd.cimterv));
      this.lista = elem4("ul", "hsz-celok");
      this.lista.hidden = true;
      this.doboz.append(this.lista);
      if (fd.magyarazat && fd.magyarazat.length) {
        this.magyarazat = magyarazatElem(fd.magyarazat);
        this.doboz.append(this.magyarazat);
        if (this.vizsga) {
          this.magyarazatZar = elem4(
            "p",
            "hsz-panel__zarva",
            "A magyarázat a vizsga végén nyílik meg (ha minden cél teljesült, vagy ha feladod)."
          );
          this.magyarazat.hidden = true;
          this.doboz.append(this.magyarazatZar);
        }
      }
      const lab = elem4("div", "hsz-panel__lab");
      this.osszegzes = elem4("p", "hsz-panel__osszegzes");
      this.osszegzes.setAttribute("role", "status");
      const gombok = elem4("div", "hsz-panel__gombok");
      this.gomb = elem4("button", "hsz-gomb hsz-gomb--fo", this.vizsga ? "Beadás" : "Ellenőrzés");
      this.gomb.type = "button";
      this.gomb.addEventListener("click", () => this.ellenoriz());
      gombok.append(this.gomb);
      if (beallitasok.bemutato) {
        this.bemutatoGomb = elem4("button", "hsz-gomb hsz-gomb--masodlagos", "Bemutató (buborékok)");
        this.bemutatoGomb.type = "button";
        this.bemutatoGomb.title = "Lépésről lépésre végigvezet a feladaton";
        this.bemutatoGomb.addEventListener("click", beallitasok.bemutato);
        gombok.append(this.bemutatoGomb);
      }
      if (this.vizsga) {
        this.feladGomb = elem4("button", "hsz-gomb hsz-gomb--masodlagos", "Feladom – mutasd a megoldást");
        this.feladGomb.type = "button";
        this.feladGomb.addEventListener("click", () => {
          const ok = typeof window === "undefined" || !window.confirm || window.confirm("Biztosan feladod? Megjelennek a parancsok, a részletes okok és a magyarázat.");
          if (ok) this.felold("feladva");
        });
        gombok.append(this.feladGomb);
      }
      lab.append(this.osszegzes, gombok);
      this.doboz.append(lab);
      szulo.append(this.doboz);
    }
    /** @private – egy teendő sora a módnak megfelelően */
    lepesSor(l) {
      const li = elem4("li", "hsz-lepes");
      li.append(szovegbe2(elem4("span", "hsz-lepes__cel"), l.cel));
      const parancs = l.parancsok ? szovegbe2(elem4("span", "hsz-lepes__parancs"), l.parancsok) : null;
      if (parancs) {
        li.append(parancs);
        parancs.hidden = this.mod !== "oktato";
      }
      const sor2 = { li, parancs, tippHely: null };
      if (this.mod === "gyakorlo") {
        const tippek = [...l.tippek];
        if (l.parancsok) tippek.push(`Megoldás: ${l.parancsok}`);
        if (tippek.length) {
          const hely = elem4("span", "hsz-lepes__tippek");
          const gomb = elem4("button", "hsz-tippgomb", "Tipp");
          gomb.type = "button";
          let hanyadik = 0;
          gomb.addEventListener("click", () => {
            if (hanyadik >= tippek.length) return;
            hely.append(szovegbe2(elem4("span", "hsz-lepes__tipp"), tippek[hanyadik]));
            hanyadik++;
            this.tippekSzama++;
            if (hanyadik >= tippek.length) {
              gomb.disabled = true;
              gomb.textContent = "Nincs több tipp";
            } else {
              gomb.textContent = `Még egy tipp (${hanyadik}/${tippek.length})`;
            }
          });
          li.append(hely, gomb);
          sor2.tippHely = hely;
        }
      }
      this.lepesSorok.push(sor2);
      return li;
    }
    /** @private */
    eltelt() {
      return (this.vegeIdo !== null ? this.vegeIdo : this.most()) - this.kezdes;
    }
    /** @private */
    oraFrissit() {
      if (!this.ora) return;
      this.ora.textContent = `Eltelt idő: ${idoSzoveg(this.eltelt())}${this.beadasok ? ` · Beadások: ${this.beadasok}` : ""}`;
    }
    /**
     * Vizsgában a részletek megnyitása (siker vagy feladás után): parancsok, okok, magyarázat.
     * @param {'siker'|'feladva'} miert
     */
    felold(miert) {
      if (this.feloldva) return;
      this.feloldva = true;
      this.vegeIdo = this.most();
      clearInterval(this.oraIdozito);
      this.oraFrissit();
      for (const s of this.lepesSorok) if (s.parancs) s.parancs.hidden = false;
      if (this.magyarazat) {
        this.magyarazat.hidden = false;
        if (this.magyarazatZar) this.magyarazatZar.remove();
      }
      for (const m of this.lista.querySelectorAll(".hsz-cel__megj")) m.hidden = false;
      if (this.feladGomb) this.feladGomb.remove();
      if (miert === "feladva") {
        this.osszegzes.textContent = `Feladva ${idoSzoveg(this.eltelt())} után. Most már látszanak a parancsok, a részletes okok és a magyarázat – javítsd ki, és nyomd meg az Ellenőrzést.`;
        this.osszegzes.className = "hsz-panel__osszegzes";
        this.gomb.textContent = "Ellenőrzés";
        this.vizsgaVege = true;
      }
    }
    /** Az ellenőrzés (vizsgában: beadás) indítása. */
    ellenoriz() {
      if (this.fut) return;
      this.fut = true;
      const beadas = this.vizsga && !this.vizsgaVege;
      if (beadas) this.beadasok++;
      this.oraFrissit();
      this.gomb.disabled = true;
      this.gomb.textContent = beadas ? "Értékelés folyik…" : "Ellenőrzés folyik…";
      this.osszegzes.textContent = "A próbák futnak – figyeld a csomagokat a rajzon!";
      this.osszegzes.className = "hsz-panel__osszegzes";
      this.lista.textContent = "";
      this.lista.hidden = false;
      const sorok = this.f.feladat.celok.map((c) => {
        const li = elem4("li", "hsz-cel hsz-cel--var");
        const jel = elem4("span", "hsz-cel__jel", "·");
        jel.setAttribute("aria-hidden", "true");
        const szoveg = elem4("span", "hsz-cel__szoveg");
        const cim = elem4("span", "hsz-cel__cim", c.szoveg);
        if (c.ellenproba) cim.classList.add("hsz-cel__cim--ellenproba");
        const megj = elem4("span", "hsz-cel__megj");
        megj.hidden = !this.feloldva;
        const allapot3 = elem4("span", "hsz-rejtett", probaE(c) ? "vár" : "");
        szoveg.append(cim, megj);
        li.append(jel, allapot3, szoveg);
        this.lista.append(li);
        return { li, jel, megj, allapot: allapot3 };
      });
      ellenoriz(this.f, {
        szunet: PROBA_SZUNET,
        indul: (i) => {
          sorok[i].li.className = "hsz-cel hsz-cel--fut";
          sorok[i].jel.textContent = "…";
          sorok[i].allapot.textContent = "fut";
          if (sorok[i].li.scrollIntoView) sorok[i].li.scrollIntoView({ block: "nearest", behavior: "smooth" });
        },
        lepes: (i, e) => {
          const s = sorok[i];
          s.li.className = `hsz-cel ${e.ok ? "hsz-cel--ok" : "hsz-cel--hiba"}`;
          s.jel.textContent = e.ok ? "✔" : "✘";
          s.allapot.textContent = e.ok ? "teljesült" : "nem teljesült";
          s.megj.textContent = e.megjegyzes;
        },
        kesz: (eredmenyek) => this.kiertekel(eredmenyek, beadas)
      });
    }
    /** @private */
    kiertekel(eredmenyek, beadas) {
      const jo = eredmenyek.filter((e) => e.ok).length;
      const osszes = eredmenyek.length;
      const mind = jo === osszes;
      this.utolsoEredmeny = { jo, osszes, mind };
      this.fut = false;
      this.gomb.disabled = false;
      if (this.beallitasok.ellenorzesUtan) setTimeout(this.beallitasok.ellenorzesUtan, 0);
      if (beadas) {
        if (mind) {
          this.felold("siker");
          this.vizsgaVege = true;
          this.osszegzes.textContent = `Sikeres vizsga! Mind a ${osszes} cél teljesült, az ellenpróbák is. Idő: ${idoSzoveg(this.eltelt())}, ${this.beadasok}. beadásra. A magyarázat most már elolvasható.`;
          this.osszegzes.classList.add("hsz-panel__osszegzes--siker");
          this.gomb.textContent = "Ellenőrzés";
        } else {
          this.osszegzes.textContent = `${jo} / ${osszes} cél teljesült (${this.beadasok}. beadás). A ✘ jelűeket nézd át – a részletes okokat a vizsga végén látod. Javíts, és add be újra!`;
          this.gomb.textContent = "Beadás újra";
        }
        return;
      }
      if (mind) {
        const tipp = this.mod === "gyakorlo" ? this.tippekSzama ? ` (${this.tippekSzama} tipp segítségével)` : " – tipp nélkül!" : "";
        this.osszegzes.textContent = `Kész! Mind a ${osszes} cél teljesült, az ellenpróbák is${tipp}. Szép munka!`;
        this.osszegzes.classList.add("hsz-panel__osszegzes--siker");
      } else {
        this.osszegzes.textContent = `${jo} / ${osszes} cél teljesült. A ✘ jelűeknél olvasd el, mi a gond, javítsd, és ellenőrizz újra.`;
      }
      this.gomb.textContent = "Ellenőrzés újra";
    }
    /** A panel leállítása (az óra megáll). */
    leallit() {
      clearInterval(this.oraIdozito);
    }
  };
  function valtozatSor(mag, link) {
    const p = elem4("p", "hsz-panel__valtozat");
    p.append(document.createTextNode("Véletlen adatok – változat: "), elem4("b", "", `#${mag}`));
    if (!link) return p;
    const gomb = elem4("button", "hsz-tippgomb", "Link másolása");
    gomb.type = "button";
    gomb.title = "Ezzel a linkkel bárki pontosan ezt a változatot kapja (pl. a tanár az osztálynak)";
    const mezo = elem4("input", "hsz-panel__link");
    mezo.type = "text";
    mezo.readOnly = true;
    mezo.hidden = true;
    mezo.setAttribute("aria-label", "A változat linkje");
    const megmutat = () => {
      mezo.value = link();
      mezo.hidden = false;
      mezo.focus();
      mezo.select();
    };
    gomb.addEventListener("click", () => {
      const url = link();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          gomb.textContent = "Kimásolva!";
          setTimeout(() => {
            gomb.textContent = "Link másolása";
          }, 2e3);
        }, megmutat);
      } else {
        megmutat();
      }
    });
    p.append(document.createTextNode(" "), gomb, mezo);
    return p;
  }
  function cimtervTabla(cimterv) {
    const cim = elem4("h3", "hsz-panel__alcim", "Címterv");
    const tabla = elem4("table", "hsz-panel__tabla");
    const vanInterfesz = cimterv.some((s) => s.interfesz);
    const OSZLOPOK = [
      ["eszkoz", vanInterfesz ? "Eszköz" : "Gép"],
      ["interfesz", "Interfész"],
      ["ip", vanInterfesz ? "IPv4-cím" : "IP-cím"],
      ["maszk", "Maszk"],
      ["ipv6", "IPv6-cím"],
      ["atjaro", "Átjáró"],
      ["vlan", "VLAN"],
      ["hova", "Port"]
    ].filter(([k]) => cimterv.some((s) => s[k] !== void 0 && s[k] !== ""));
    const fejsor = elem4("tr");
    for (const [, c] of OSZLOPOK) fejsor.append(elem4("th", "", c));
    const thead = elem4("thead");
    thead.append(fejsor);
    const tbody = elem4("tbody");
    let elozo = null;
    for (const s of cimterv) {
      const tr = elem4("tr");
      for (const [k] of OSZLOPOK) {
        const v = k === "eszkoz" && vanInterfesz && s.eszkoz === elozo ? "" : s[k];
        tr.append(elem4("td", "", v === void 0 ? "" : String(v)));
      }
      elozo = s.eszkoz;
      tbody.append(tr);
    }
    tabla.append(thead, tbody);
    const gorgeto = elem4("div", "hsz-panel__tablahely");
    gorgeto.append(tabla);
    return [cim, gorgeto];
  }
  function magyarazatElem(magyarazat) {
    const d = elem4("details", "hsz-magyarazat");
    d.append(elem4("summary", "hsz-magyarazat__cim", "Magyarázat: mit, miért és miért így állítunk be?"));
    for (const resz of magyarazat) {
      d.append(szovegbe2(elem4("h4", "hsz-magyarazat__alcim"), resz.cim));
      for (const bek of resz.szoveg || []) {
        if (Array.isArray(bek)) {
          const ul = elem4("ul", "hsz-magyarazat__lista");
          for (const li of bek) ul.append(szovegbe2(elem4("li"), li));
          d.append(ul);
        } else {
          d.append(szovegbe2(elem4("p", "hsz-magyarazat__szoveg"), bek));
        }
      }
    }
    return d;
  }

  // src/modell/pc.js
  function ujPc({ nev }) {
    return {
      tipus: "pc",
      modell: "pc",
      hostname: nev,
      mac: macNevbol("pc:" + nev),
      ip: "",
      maszk: "",
      atjaro: "",
      arpTabla: {},
      ipv6: "",
      ipv6Hossz: 64,
      ipv6Atjaro: "",
      ndTabla: {},
      portok: [{ nev: "FastEthernet0", rovid: "Fa0", tipus: "FastEthernet", szam: "0", leallitva: false, fent: false }]
    };
  }

  // src/feladat/betolto.js
  function feladatLista() {
    const g = typeof window !== "undefined" ? window : globalThis;
    return g.HaloszimFeladatok || [];
  }
  function feladatKeres(azon) {
    const lista3 = feladatLista();
    if (!azon) return lista3[0] || null;
    return lista3.find((f) => f.azon === azon) || null;
  }
  function feladatBetolt(feladat, beallitasok = {}) {
    const halozat = new Halozat(beallitasok);
    const nevek = /* @__PURE__ */ new Map();
    const elemek = [];
    for (const e of feladat.topologia.eszkozok) {
      let eszkoz;
      if (e.tipus === "switch") eszkoz = ujSwitch2960({ hostname: e.nev });
      else if (e.tipus === "pc") eszkoz = ujPc({ nev: e.nev });
      else if (e.tipus === "router") eszkoz = ujRouter4331({ hostname: e.nev });
      else throw new Error(`Ismeretlen eszköztípus: ${e.tipus}`);
      halozat.hozzaad(eszkoz);
      nevek.set(e.nev, eszkoz);
      elemek.push({ nev: e.nev, eszkoz, x: e.x, y: e.y, tipus: e.tipus, felirat: e.felirat });
    }
    for (const [nev, beall2] of Object.entries(feladat.kiindulo || {})) {
      const eszkoz = nevek.get(nev);
      if (eszkoz.tipus === "pc") {
        ipBeallit(eszkoz, beall2);
        continue;
      }
      if (eszkoz.tipus === "router") {
        routerBeallit(eszkoz, beall2);
        continue;
      }
      if (beall2.hostname) eszkoz.hostname = beall2.hostname;
      const v = beall2.vtp || {};
      if (v.mod) eszkoz.vtpMod = v.mod;
      if (v.tartomany) eszkoz.vtpTartomany = v.tartomany;
      if (v.jelszo) eszkoz.vtpJelszo = v.jelszo;
      if (v.verzio) eszkoz.vtpVerzio = v.verzio;
      if (v.revizio) eszkoz.vtpRevizio = v.revizio;
      for (const [szam, vnev] of Object.entries(beall2.vlanok || {})) {
        eszkoz.vlanok[szam] = { nev: vnev, gyari: false, tamogatott: true };
      }
    }
    for (const [a, pa, b, pb, opciok] of feladat.topologia.kabelek || []) {
      halozat.kabel(nevek.get(a), pa, nevek.get(b), pb, opciok || {});
    }
    vtpIdozitoIndit(halozat);
    ripIndit(halozat);
    ospfIndit(halozat);
    for (const e of halozat.eszkozok) {
      if (e.tipus !== "router") continue;
      ripValtozott(e, { keres: true });
      ospfValtozott(e);
    }
    return {
      feladat,
      halozat,
      elemek,
      eszkoz: (nev) => {
        const e = nevek.get(nev);
        if (!e) throw new Error(`Nincs ilyen eszköz a feladatban: ${nev}`);
        return e;
      }
    };
  }
  function routerBeallit(r, b) {
    if (b.hostname) r.hostname = b.hostname;
    for (const [pnev, pb] of Object.entries(b.portok || {})) {
      let p = routerPort(r, pnev);
      if (!p && /^Loopback\d+$/.test(pnev)) p = loopbackLetrehoz(r, Number(pnev.slice(8)));
      if (!p) throw new Error(`Nincs ilyen port: ${r.hostname} ${pnev}`);
      if (pb.ip) {
        p.ip = pb.ip;
        p.maszk = pb.maszk;
      }
      for (const c of pb.ipv6 || []) {
        const pr = ipv6PrefixElemez(c);
        if (!pr) throw new Error(`Hibás IPv6-cím: ${c}`);
        p.ipv6.push({ cim: ipv6Normal(c.split("/")[0]), hossz: pr.hossz });
      }
      if (pb.linkLocal) p.linkLocal = ipv6Normal(pb.linkLocal);
      if (pb.ospf) Object.assign(p.ospf, pb.ospf);
      if (pb.ospf6) Object.assign(p.ospf6, pb.ospf6);
      if (pb.mtu) p.mtu = pb.mtu;
      if (pb.mtu6) p.mtu6 = pb.mtu6;
      if (pb.leiras) p.leiras = pb.leiras;
      p.leallitva = pb.be === false;
      if (p.tipus === "Loopback") p.fent = !p.leallitva;
    }
    for (const s of b.statikus || []) r.statikus.push({ ...s });
    for (const s of b.statikus6 || []) r.statikus6.push({ prefix: s.prefix, kovetkezo: s.kovetkezo ? ipv6Normal(s.kovetkezo) : void 0, interfesz: s.interfesz });
    if (b.ipv6Routing) r.ipv6Routing = true;
    if (b.ospf) r.ospf = { ...ujOspf(b.ospf.folyamat || 1), ...b.ospf };
    if (b.ospf6) r.ospf6 = { ...ujOspf(b.ospf6.folyamat || 1), ...b.ospf6 };
  }

  // src/feladat/veletlen.js
  function generator(mag) {
    let a = Number(mag) >>> 0 || 1;
    return () => {
      a = a + 1831565813 >>> 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function ujMag() {
    return 1 + Math.floor(Math.random() * 99999);
  }
  function ervenyesMag(m) {
    return /^\d{1,9}$/.test(String(m)) && Number(m) > 0;
  }
  function ertekek(valtozok = {}, mag = null) {
    const e = {};
    const r = mag === null ? null : generator(mag);
    for (const [nev, sz] of Object.entries(valtozok)) {
      if (!r) {
        e[nev] = sz.alap;
        continue;
      }
      const tilos = (sz.kulonbozik || []).map((n) => e[n]);
      let ertek;
      for (let proba = 0; proba < 200; proba++) {
        ertek = sorsol(sz, r);
        if (!tilos.includes(ertek)) break;
      }
      if (tilos.includes(ertek)) throw new Error(`Nem sikerült különböző értéket sorsolni: ${nev}`);
      e[nev] = ertek;
    }
    return e;
  }
  function sorsol(sz, r) {
    if (sz.tipus === "szam") return sz.min + Math.floor(r() * (sz.max - sz.min + 1));
    if (sz.tipus === "lista") return sz.lista[Math.floor(r() * sz.lista.length)];
    if (sz.tipus === "jelszo") {
      const szo = sz.lista[Math.floor(r() * sz.lista.length)];
      const jegyek = 2 + Math.floor(r() * 3);
      let szam = "";
      for (let i = 0; i < jegyek; i++) szam += Math.floor(r() * 10);
      return szo + szam;
    }
    throw new Error(`Ismeretlen változótípus: ${sz.tipus}`);
  }
  var HELYORZO = /\{([A-Z][A-Z0-9_]*)(?:\|(es|a|aes|Aes))?\}/g;
  var CSAK_HELYORZO = /^\{([A-Z][A-Z0-9_]*)\}$/;
  function behelyettesit(szoveg, e) {
    const csak = CSAK_HELYORZO.exec(szoveg);
    if (csak && typeof e[csak[1]] === "number") return e[csak[1]];
    return szoveg.replace(HELYORZO, (teljes, nev, mod) => {
      if (!(nev in e)) return teljes;
      const v = e[nev];
      if (!mod) return String(v);
      if (mod === "es") return esRag(v);
      if (mod === "a") return `${nevelo(v)} ${v}`;
      const t = `${nevelo(v)} ${esRag(v)}`;
      return mod === "Aes" ? t[0].toUpperCase() + t.slice(1) : t;
    });
  }
  function bejar2(x, e) {
    if (typeof x === "string") return behelyettesit(x, e);
    if (Array.isArray(x)) return x.map((y) => bejar2(y, e));
    if (x && typeof x === "object") {
      const uj = {};
      for (const [k, v] of Object.entries(x)) uj[behelyettesit(k, e)] = bejar2(v, e);
      return uj;
    }
    return x;
  }
  function feladatValtozat(feladat, mag = null) {
    const e = ertekek(feladat.valtozok, mag);
    const { valtozok, ...tobbi } = feladat;
    const v = bejar2(tobbi, e);
    v.mag = mag;
    v.ertekek = e;
    v.eredeti = feladat;
    void valtozok;
    return v;
  }

  // src/fo.js
  var VERZIO = true ? "0.9.0" : "fejlesztői";
  var HIBAJELENTO = "https://routerrantotta.hu/otlet.html";
  var ANIM_KESLELTETES = 260;
  var SEBESSEGEK = [
    { nev: "Nagyon lassú", szorzo: 0.2 },
    { nev: "Lassú", szorzo: 0.4 },
    { nev: "Normál", szorzo: 1 },
    { nev: "Gyors", szorzo: 2 }
  ];
  var SZABAD = {
    azon: "szabad",
    cim: "Szabad gyakorlás",
    topologia: { meret: { szel: 400, mag: 120 }, eszkozok: [{ nev: "Switch", tipus: "switch", x: 44, y: 34 }], kabelek: [] },
    celok: []
  };
  function elem5(tag, osztaly, szoveg) {
    const e = document.createElement(tag);
    if (osztaly) e.className = osztaly;
    if (szoveg !== void 0) e.textContent = szoveg;
    return e;
  }
  function tipusa(f) {
    return f.tipus || "Egyéb";
  }
  function indit(gyoker, beallitasok = {}) {
    gyoker.classList.add("hsz");
    gyoker.textContent = "";
    let azon = beallitasok.feladat;
    let mod = beallitasok.mod;
    let kezdoMag = beallitasok.mag;
    try {
      const p = new URLSearchParams(window.location.search);
      azon = p.get("feladat") || azon;
      mod = p.get("mod") || mod;
      if (p.get("mag")) kezdoMag = p.get("mag");
    } catch (e) {
    }
    kezdoMag = ervenyesMag(kezdoMag) ? Number(kezdoMag) : null;
    if (!MODOK2[mod]) mod = "oktato";
    let sebesseg = SEBESSEGEK.some((x) => x.szorzo === beallitasok.sebesseg) ? beallitasok.sebesseg : 1;
    const sebessegKezelo = { kap: () => sebesseg, allit: (x) => {
      sebesseg = x;
    } };
    const hibajelento = typeof beallitasok.hibajelento === "string" && beallitasok.hibajelento ? beallitasok.hibajelento : HIBAJELENTO;
    const kisKepernyo = elem5("p", "hsz-kiskepernyo", "Tipp: nagyobb képernyőn kényelmesebb a gyakorlás.");
    const tartalom = elem5("div", "hsz-tartalom");
    gyoker.append(kisKepernyo);
    const lista3 = feladatLista();
    let aktualis = null;
    let fut2 = null;
    let mag = null;
    const valtozatLink = () => {
      try {
        const url = new URL(window.location.href);
        if (aktualis && aktualis.azon !== "szabad") url.searchParams.set("feladat", aktualis.azon);
        url.searchParams.set("mod", mod);
        if (mag !== null) url.searchParams.set("mag", String(mag));
        else url.searchParams.delete("mag");
        return url.toString();
      } catch (e) {
        return "";
      }
    };
    const betolt = (feladat, ujMod = mod, ujMagErtek) => {
      if (fut2) fut2.leallit();
      tartalom.textContent = "";
      aktualis = feladat;
      mod = ujMod;
      if (mod === "oktato" || !feladat.valtozok) mag = null;
      else mag = ujMagErtek !== void 0 && ujMagErtek !== null ? ujMagErtek : ujMag();
      fut2 = feladatInditas(tartalom, feladatValtozat(feladat, mag), mod, valtozatLink, sebessegKezelo, hibajelento);
      if (valaszto) valaszto.igazit(feladat, mod);
      try {
        window.history.replaceState(null, "", valtozatLink());
      } catch (e) {
      }
    };
    const mehet = (kerdes) => !fut2 || !fut2.piszkos || window.confirm(kerdes);
    const valaszto = lista3.length ? feladatValaszto(lista3, {
      feladat: (f) => {
        if (!mehet("Másik feladatra váltasz? Az eddigi beállítások elvesznek.")) return false;
        betolt(f);
        return true;
      },
      mod: (m) => {
        if (m === mod) return true;
        if (!mehet(`${MODOK2[m].nev} módra váltasz? A feladat újraindul, az eddigi beállítások elvesznek.`)) return false;
        betolt(aktualis, m);
        return true;
      },
      ujra: () => {
        if (!mehet("Biztosan újrakezded? Minden eddigi beállítás elvész.")) return;
        betolt(aktualis, mod, mag);
      },
      ujValtozat: () => {
        if (!mehet("Új változatot kérsz (más számokkal és nevekkel)? Az eddigi beállítások elvesznek.")) return;
        betolt(aktualis, mod);
      }
    }) : null;
    if (valaszto) gyoker.append(valaszto.doboz);
    gyoker.append(tartalom);
    betolt(feladatKeres(azon) || SZABAD, mod, kezdoMag);
    return {
      /** Feladat betöltése azonosító szerint. */
      betolt: (az) => {
        const f = feladatKeres(az);
        if (f) betolt(f);
      },
      get mod() {
        return mod;
      },
      get mag() {
        return mag;
      },
      /** Mód váltása (a feladat újraindul). */
      modValt: (m, ujM) => {
        if (MODOK2[m]) betolt(aktualis, m, ujM);
      },
      get panel() {
        return fut2.panel;
      },
      get feladat() {
        return fut2.feladat;
      },
      get halozat() {
        return fut2.halozat;
      },
      get ora() {
        return fut2.ora;
      },
      get nezetek() {
        return fut2.nezetek;
      },
      get eszkoz() {
        return fut2.eszkoz;
      },
      get munkamenet() {
        return fut2.munkamenet;
      },
      get terminal() {
        return fut2.terminal;
      },
      valaszt: (e, fokusz) => fut2.valaszt(e, fokusz)
    };
  }
  function feladatValaszto(lista3, h) {
    const doboz = elem5("div", "hsz-valaszto");
    doboz.setAttribute("role", "group");
    doboz.setAttribute("aria-label", "Feladat és mód választása");
    const mezo = (felirat) => {
      const l = elem5("label", "hsz-valaszto__mezo");
      const sel = elem5("select");
      l.append(elem5("span", "", felirat), sel);
      doboz.append(l);
      return sel;
    };
    const tipusSel = mezo("Feladattípus");
    const feladatSel = mezo("Feladat");
    const modMezo = elem5("div", "hsz-valaszto__mezo");
    const modCim = elem5("span", "", "Mód");
    modCim.id = `hsz-mod-${Math.random().toString(36).slice(2, 8)}`;
    const modGombok = elem5("div", "hsz-modok");
    modGombok.setAttribute("role", "group");
    modGombok.setAttribute("aria-labelledby", modCim.id);
    const gombok = {};
    for (const [kulcs2, m] of Object.entries(MODOK2)) {
      const g = elem5("button", "hsz-modgomb", m.nev);
      g.type = "button";
      g.title = m.leiras;
      g.addEventListener("click", () => h.mod(kulcs2));
      gombok[kulcs2] = g;
      modGombok.append(g);
    }
    modMezo.append(modCim, modGombok);
    doboz.append(modMezo);
    const ujraGomb = elem5("button", "hsz-gomb hsz-gomb--masodlagos", "Újrakezdés");
    ujraGomb.type = "button";
    ujraGomb.title = "A feladat újraindítása az elejéről (minden beállítás elvész)";
    ujraGomb.addEventListener("click", () => h.ujra());
    const ujValtGomb = elem5("button", "hsz-gomb hsz-gomb--masodlagos", "Új változat");
    ujValtGomb.type = "button";
    ujValtGomb.title = "Ugyanez a feladat más véletlen adatokkal (számok, nevek, címek)";
    ujValtGomb.addEventListener("click", () => h.ujValtozat());
    doboz.append(ujraGomb, ujValtGomb);
    const tipusok = [...new Set(lista3.map(tipusa))];
    for (const t of tipusok) tipusSel.append(new Option(t, t));
    const feladatokTolt = (tipus) => {
      feladatSel.textContent = "";
      for (const f of lista3.filter((x) => tipusa(x) === tipus)) {
        feladatSel.append(new Option(f.szint ? `${f.cim} (${f.szint})` : f.cim, f.azon));
      }
    };
    let jelenlegi = null;
    const visszaallit = () => {
      if (jelenlegi) {
        tipusSel.value = tipusa(jelenlegi);
        feladatokTolt(tipusa(jelenlegi));
        feladatSel.value = jelenlegi.azon;
      }
    };
    tipusSel.addEventListener("change", () => {
      feladatokTolt(tipusSel.value);
      if (!h.feladat(lista3.find((x) => x.azon === feladatSel.value))) visszaallit();
    });
    feladatSel.addEventListener("change", () => {
      if (!h.feladat(lista3.find((x) => x.azon === feladatSel.value))) visszaallit();
    });
    return {
      doboz,
      /** A választó beállítása az éppen futó feladatra és módra. */
      igazit(f, mod) {
        for (const [kulcs2, g] of Object.entries(gombok)) {
          g.setAttribute("aria-pressed", String(kulcs2 === mod));
          g.classList.toggle("hsz-modgomb--aktiv", kulcs2 === mod);
        }
        ujValtGomb.hidden = mod === "oktato" || !f.valtozok;
        if (!lista3.includes(f)) return;
        jelenlegi = f;
        visszaallit();
      }
    };
  }
  function bemutatoIndito({ f, feladat, gyoker, panel, topologia, nezetek, utolsoParancs, halozat, valasztott }) {
    const nevbol = (nev) => f.eszkoz(nev);
    const nevre = (eszkoz) => {
      const el = f.elemek.find((x) => x.eszkoz === eszkoz);
      return el ? el.nev : null;
    };
    const vezeto = new Vezeto(feladat.bemutato, {
      f,
      valasztott: () => nevre(valasztott()),
      munkamenet: (nev) => {
        const n = nezetek.get(nevbol(nev));
        return n && n.munkamenet;
      },
      utolsoParancs: (nev) => utolsoParancs.get(nevbol(nev)) || "",
      ellenorzesKesz: () => !!(panel && panel.utolsoEredmeny && panel.utolsoEredmeny.mind),
      foglalt: (nev) => {
        const n = nezetek.get(nevbol(nev));
        return !!(n && n.terminal.foglalt);
      }
    });
    let buborek = null;
    let aktiv2 = false;
    let utoljaraMutatott = null;
    let utolsoCel = null;
    let idozito = null;
    const celElem = (l) => {
      if (l.hol === "ellenorzes") return panel ? panel.gomb : null;
      if (l.hol === "panel") return panel ? panel.doboz : null;
      const eszkoz = l.eszkoz ? nevbol(l.eszkoz) : null;
      const n = eszkoz && nezetek.get(eszkoz);
      if (l.hol === "eszkoz") {
        const r = topologia.rajzok.get(eszkoz);
        return r ? r.g : null;
      }
      if (!n) return null;
      if (valasztott() !== eszkoz) return n.ful;
      if (l.hol === "pc") return n.urlap || n.doboz;
      return n.terminal.sor.hidden ? n.terminal.doboz : n.terminal.sor;
    };
    const mutat = () => {
      if (!aktiv2) return;
      if (panel && panel.fut) {
        buborek.elrejt();
        utoljaraMutatott = null;
        utolsoCel = null;
        return;
      }
      const l = vezeto.aktualis();
      const bezar = () => leallitas();
      if (!l) {
        if (utoljaraMutatott === "vege") {
          buborek.helyez();
          return;
        }
        buborek.mutat({
          cel: panel ? panel.doboz : null,
          szamlalo: "Vége",
          szoveg: "Gratulálok, végigértél a bemutatón! A feladatpanel alján, a Magyarázatban elolvashatod, mit miért csináltunk.",
          miert: "Próbáld ki Gyakorló módban is: ott már csak a cél látszik, és más adatokat (számokat, neveket, címeket) kapsz.",
          gombok: [{ felirat: "Bezárás", fn: bezar, fo: true }],
          bezar,
          gorget: utoljaraMutatott !== "vege"
        });
        utoljaraMutatott = "vege";
        return;
      }
      const eszkoz = l.eszkoz ? nevbol(l.eszkoz) : null;
      const n = eszkoz && nezetek.get(eszkoz);
      if (l.hol === "terminal" && n && n.terminal.foglalt && valasztott() === eszkoz) {
        buborek.elrejt();
        utoljaraMutatott = null;
        utolsoCel = null;
        return;
      }
      const masikEszkoz = (l.hol === "terminal" || l.hol === "pc") && valasztott() !== eszkoz;
      const szoveg = masikEszkoz ? `Előbb válaszd ki: ${l.eszkoz} (kattints a fülére, vagy rá a rajzon). Utána: ${l.szoveg}` : l.szoveg;
      const kulcs2 = `${vezeto.index}:${masikEszkoz}`;
      const cel = celElem(l);
      if (kulcs2 === utoljaraMutatott && cel === utolsoCel) {
        buborek.helyez();
        return;
      }
      utolsoCel = cel;
      buborek.mutat({
        cel,
        szamlalo: `Bemutató · ${vezeto.index + 1} / ${vezeto.lepesek.length}`,
        szoveg,
        miert: l.miert,
        gombok: [
          { felirat: "Kihagyom ezt a lépést", fn: () => {
            vezeto.kihagy();
            frissit2();
          } },
          { felirat: "Bemutató bezárása", fn: bezar }
        ],
        bezar,
        gorget: utoljaraMutatott !== kulcs2
      });
      utoljaraMutatott = kulcs2;
    };
    const frissit2 = () => {
      if (!aktiv2) return;
      vezeto.frissit();
      mutat();
    };
    const leallitas = () => {
      aktiv2 = false;
      clearInterval(idozito);
      if (buborek) buborek.elrejt();
    };
    let leiratkozas = null;
    return {
      indit() {
        if (!buborek) buborek = new Buborek(gyoker);
        aktiv2 = true;
        vezeto.index = 0;
        utoljaraMutatott = null;
        utolsoCel = null;
        clearInterval(idozito);
        idozito = setInterval(frissit2, 500);
        if (!leiratkozas) leiratkozas = halozat.figyel((e) => {
          if (e.tipus === "allapot") frissit2();
        });
        frissit2();
      },
      frissit: frissit2,
      megszuntet() {
        leallitas();
        if (buborek) buborek.megszuntet();
      }
    };
  }
  function sebessegValaszto(sebesseg) {
    const sor2 = elem5("div", "hsz-sebesseg");
    const cim = elem5("span", "hsz-sebesseg__cim", "Csomagok sebessége:");
    cim.id = `hsz-seb-${Math.random().toString(36).slice(2, 8)}`;
    const csoport = elem5("div", "hsz-modok hsz-modok--kicsi");
    csoport.setAttribute("role", "group");
    csoport.setAttribute("aria-labelledby", cim.id);
    const gombok = SEBESSEGEK.map((s) => {
      const g = elem5("button", "hsz-modgomb", s.nev);
      g.type = "button";
      g.title = s.szorzo === 1 ? "Valós idő" : `${s.szorzo < 1 ? "Lassítva" : "Gyorsítva"}: ${String(s.szorzo).replace(".", ",")}×`;
      g.addEventListener("click", () => {
        sebesseg.allit(s.szorzo);
        frissit2();
      });
      csoport.append(g);
      return { g, s };
    });
    const frissit2 = () => {
      for (const { g, s } of gombok) {
        const aktiv2 = s.szorzo === sebesseg.kap();
        g.classList.toggle("hsz-modgomb--aktiv", aktiv2);
        g.setAttribute("aria-pressed", String(aktiv2));
      }
    };
    frissit2();
    sor2.append(cim, csoport);
    return sor2;
  }
  function feladatInditas(gyoker, feladat, mod, valtozatLink, sebesseg, hibajelento = HIBAJELENTO) {
    const ora = new Ora();
    let elozo = performance.now();
    const idozito = setInterval(() => {
      const most5 = performance.now();
      ora.lep((most5 - elozo) * sebesseg.kap());
      elozo = most5;
    }, 20);
    const f = feladatBetolt(feladat, { ora, kesleltetes: ANIM_KESLELTETES });
    const { halozat } = f;
    const szeles = feladat.topologia.meret && feladat.topologia.meret.szel > 900;
    const felso = elem5("div", `hsz-felso${!feladat.celok.length || szeles ? " hsz-felso--egy" : ""}`);
    const munka = elem5("section", "hsz-munka");
    munka.setAttribute("aria-label", "Az eszközök kezelése");
    gyoker.append(felso, munka);
    let valasztott = null;
    const topologia = new Topologia(felso, { elemek: f.elemek, halozat, meret: feladat.topologia.meret, feliratok: feladat.topologia.feliratok }, {
      sebesseg: sebesseg.kap,
      valaszt: (e) => valaszt(e, true)
    });
    topologia.doboz.append(sebessegValaszto(sebesseg));
    const vanBemutato = mod === "oktato" && Array.isArray(feladat.bemutato) && feladat.bemutato.length > 0;
    let bemutato = null;
    const panel = feladat.celok.length ? new FeladatPanel(felso, f, {
      mod,
      valtozatLink,
      bemutato: vanBemutato ? () => bemutato.indit() : void 0,
      ellenorzesUtan: () => bemutato && bemutato.frissit()
    }) : null;
    const utolsoParancs = /* @__PURE__ */ new Map();
    let piszkos = false;
    const jelzo = elem5("a", "hsz-jelzo", "Hibás a kimenet? Jelezd!");
    jelzo.target = "_blank";
    jelzo.rel = "noopener";
    const jelzoFrissit = (parancs) => {
      const p = new URLSearchParams({ oldal: "szimulator/index.html" });
      p.set("parancs", (parancs || "").slice(0, 200));
      jelzo.href = `${hibajelento}?${p}`;
    };
    jelzoFrissit("");
    const fulek = elem5("div", "hsz-fulek");
    fulek.setAttribute("role", "tablist");
    fulek.setAttribute("aria-label", "Eszközök");
    const nezetHely = elem5("div", "hsz-nezetek");
    munka.append(fulek, nezetHely);
    const nezetek = /* @__PURE__ */ new Map();
    const frissitMind = () => {
      piszkos = true;
      topologia.frissit();
      for (const n of nezetek.values()) n.cimFrissit();
      if (bemutato) bemutato.frissit();
    };
    for (const { eszkoz, tipus } of f.elemek) {
      const ful = elem5("button", "hsz-ful");
      ful.type = "button";
      ful.setAttribute("role", "tab");
      ful.addEventListener("click", () => valaszt(eszkoz, true));
      fulek.append(ful);
      let n;
      if (tipus === "switch" || tipus === "router") {
        const doboz = elem5("div", "hsz-nezet");
        const munkamenet = new Munkamenet({ szemelyiseg: szemelyiseg(eszkoz), eszkoz, ora });
        const terminal = new Terminal(doboz, munkamenet, {
          parancsUtan: (sor2) => {
            utolsoParancs.set(eszkoz, sor2);
            jelzoFrissit(sor2);
            if (bemutato) setTimeout(bemutato.frissit, 0);
          }
        });
        munkamenet.figyel(frissitMind);
        nezetHely.append(doboz);
        n = {
          doboz,
          terminal,
          munkamenet,
          mutat: (l) => {
            doboz.hidden = !l;
          },
          cimFrissit: () => {
            terminal.cim(`${eszkoz.hostname} – konzol`);
            ful.textContent = eszkoz.hostname;
          }
        };
      } else {
        const ablak = new PcAblak(nezetHely, {
          eszkoz,
          halozat,
          ipv6: !!feladat.ipv6,
          atjaroKell: f.elemek.some((x) => x.tipus === "router"),
          valtozott: frissitMind,
          parancsUtan: (sor2) => {
            utolsoParancs.set(eszkoz, sor2);
            if (bemutato) setTimeout(bemutato.frissit, 0);
          }
        });
        n = {
          urlap: ablak.urlap,
          doboz: ablak.doboz,
          terminal: ablak.terminal,
          munkamenet: ablak.munkamenet,
          mutat: (l) => ablak.mutat(l),
          cimFrissit: () => {
            ful.textContent = eszkoz.hostname;
          }
        };
        ablak.munkamenet.figyel(frissitMind);
      }
      n.ful = ful;
      n.cimFrissit();
      n.mutat(false);
      nezetek.set(eszkoz, n);
    }
    halozat.figyel((e) => {
      if (e.tipus === "naplo" && nezetek.has(e.eszkoz)) nezetek.get(e.eszkoz).terminal.aszinkronSor(e.sor);
    });
    function valaszt(eszkoz, fokusz) {
      valasztott = eszkoz;
      for (const [e, n] of nezetek) {
        n.mutat(e === eszkoz);
        n.ful.setAttribute("aria-selected", String(e === eszkoz));
        n.ful.classList.toggle("hsz-ful--aktiv", e === eszkoz);
      }
      topologia.kijelol(eszkoz);
      if (fokusz) nezetek.get(eszkoz).terminal.fokusz();
      if (bemutato) bemutato.frissit();
    }
    valaszt(f.elemek[0].eszkoz, false);
    if (vanBemutato) {
      bemutato = bemutatoIndito({
        f,
        feladat,
        gyoker,
        panel,
        topologia,
        nezetek,
        utolsoParancs,
        halozat,
        valasztott: () => valasztott
      });
      bemutato.indit();
    }
    const lab = elem5("div", "hsz-lab");
    const verzio = elem5("span", "", `IOS-szerű parancssor · Haloszim v${VERZIO.replace(/\.0$/, "")}`);
    lab.append(verzio, jelzo);
    gyoker.append(lab);
    const elso = nezetek.get(f.elemek[0].eszkoz);
    return {
      feladat: f,
      halozat,
      ora,
      valaszt,
      nezetek,
      get valasztott() {
        return valasztott;
      },
      // Visszafelé kompatibilis mezők (az első eszköz):
      eszkoz: f.elemek[0].eszkoz,
      munkamenet: elso.munkamenet,
      terminal: elso.terminal,
      /** A feladat leállítása (az óra megáll, a hálózat eseményei elnémulnak). */
      panel,
      get piszkos() {
        return piszkos;
      },
      leallit() {
        clearInterval(idozito);
        if (panel) panel.leallit();
        if (bemutato) bemutato.megszuntet();
        halozat.figyelok = [];
      }
    };
  }
  if (typeof window !== "undefined") {
    window.Haloszim = { indit, verzio: VERZIO };
  }
})();
