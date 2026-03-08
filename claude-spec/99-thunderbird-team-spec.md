# Thunderbird Team Guidelines

## Source

Le linee guida ufficiali del team di sviluppo Thunderbird per le WebExtension sono disponibili nel documento skill ufficiale fornito dal team. Questo file ne estrae le regole rilevanti per ThunderJira, documenta le deviazioni motivate e aggiunge requisiti non coperti dagli altri spec.

**Documentazione API ufficiale:** https://webextension-api.thunderbird.net/en/mv3/

---

## Regole Applicabili a ThunderJira

### 1. Non usare listener `async` per `runtime.onMessage`

Il listener `runtime.onMessage` **non deve essere dichiarato `async`**. Un listener `async` restituisce implicitamente una `Promise` che il motore WebExtension di Thunderbird/Firefox non riconosce come risposta valida al messaggio, causando comportamenti undefined e bug difficili da riprodurre.

**Pattern corretto:** il listener è sincrono e delega a una funzione `async`, restituendone la `Promise` esplicitamente.

```js
// CORRETTO — listener non-async che ritorna una Promise esplicita
browser.runtime.onMessage.addListener((message) => {
  // Ritorna una Promise — Thunderbird la riconosce come risposta asincrona
  return handleMessage(message)
})

async function handleMessage(message) {
  const { type, payload } = message
  try {
    const client = await getJiraClient()
    switch (type) {
      case JIRA_GET_PROJECTS:
        return { data: await client.getProjects() }
      // ...
      default:
        return { error: `Unknown message type: ${type}` }
    }
  } catch (err) {
    return { error: err.message ?? String(err) }
  }
}
```

Vedi anche: [05-messaging.md](05-messaging.md) per il catalogo messaggi completo.

---

### 2. Pattern di inizializzazione sicuro del background

Il background (Event Page) in MV3 può essere rieseguito per qualsiasi evento registrato, non solo all'avvio. Per evitare che `init()` venga eseguita più volte nella stessa sessione, usare un flag in `storage.session`:

```js
// CORRETTO — init() eseguita una sola volta per sessione
async function init() {
  const { initialized } = await browser.storage.session.get({ initialized: false })
  if (initialized) return
  await browser.storage.session.set({ initialized: true })

  // ... setup JiraClient, ecc.
}

// Registra listener NOOP su onStartup per attivare il background all'avvio
browser.runtime.onStartup.addListener(() => {})

// Esegui sempre init() (verrà bloccata dal flag se già eseguita)
init()
```

---

### 3. Verificare il tipo di ritorno delle API Thunderbird

Molte API Thunderbird restituiscono oggetti "wrapped", non array diretti. Verificare sempre la documentazione prima di accedere ai dati.

| API | Ritorna | Pattern di accesso |
|-----|---------|-------------------|
| `messageDisplay.getDisplayedMessages()` | `MessageList` | `result.messages[0]` |
| `messages.list()` | `MessageList` | `result.messages[0]` |
| `messages.query()` | `MessageList` | `result.messages[0]` |
| `messages.getHeaders()` | `HeadersDictionary` | `result["header-name"][0]` |
| `tabs.query()` | `array of Tab` | `result[0]` |
| `folders.query()` | `array of MailFolder` | `result[0]` |

**Importante:** `HeadersDictionary` usa chiavi lowercase e valori sempre array — accedere con `headers["return-path"]?.[0]`.

---

### 4. Audit API obbligatorio prima di usare nuove API Thunderbird

Prima di aggiungere qualsiasi chiamata a una nuova API Thunderbird, verificare sulla documentazione ufficiale:
- Nomi esatti dei parametri e tipi
- Tipo di ritorno effettivo della Promise
- Pattern di accesso al risultato (wrapped object vs array diretto)
- Permesso richiesto nel manifest

Non fare mai assunzioni. Non usare try-catch per "indovinare" parametri.

---

### 5. `VENDOR.md` — documentazione dipendenze di terze parti

Ogni libreria di terze parti inclusa nel progetto deve essere documentata in `VENDOR.md` nella root del progetto. Il file deve indicare:
- Nome della libreria
- Versione esatta (non link a "latest" o "main")
- URL diretto al file incluso
- Tipo di modulo (ES6 default, ES6 named, UMD)
- Import statement usato nel codice

Esempio di riga VENDOR.md:
```
| ical.js | 2.0.1 | https://github.com/niccokunzmann/ical.js/releases/tag/v2.0.1 | ES6 default | import ICAL from "./lib/ical.js" |
```

---

### 6. i18n — nessuna stringa utente hardcodata

Tutte le stringhe visibili all'utente devono essere localizzate tramite l'API i18n di Thunderbird. Non usare mai stringhe letterali hardcodate nei componenti Vue o nei file HTML.

- Le stringhe vanno in `public/_locales/en/messages.json` (e nelle altre lingue supportate)
- Il manifest deve avere la voce `"default_locale"` quando esiste la cartella `_locales`
- Nei componenti Vue usare `browser.i18n.getMessage('keyName')`

Riferimento: https://github.com/thunderbird/webext-examples/tree/master/manifest_v3/i18n

---

### 7. Tipo background: sempre `"module"`

Il background deve sempre dichiarare `"type": "module"` nel manifest. Questo è già corretto nella nostra spec (vedi [02-manifest-and-permissions.md](02-manifest-and-permissions.md)).

```json
"background": {
  "scripts": ["background/background.js"],
  "type": "module"
}
```

---

### 8. `browser_specific_settings` (non `applications`)

Usare sempre `browser_specific_settings` nel manifest. L'entry `applications` è deprecata e non supportata in MV3. Già corretto nella nostra spec.

---

## Deviazioni Documentate

### Deroga A — Build tool (Vite)

Il team Thunderbird consiglia di evitare build tool per i principianti. ThunderJira è un progetto **avanzato** che usa Vue 3 + Pinia, il che richiede necessariamente un build tool (Vite).

**Conseguenza:** ThunderJira rientra nella categoria "Advanced developers" del processo di revisione ATN e richiede:
- **Source code submission** al momento della pubblicazione su ATN
- File `DEVELOPER.md` nella root del sorgente con le istruzioni di build:
  ```
  npm ci
  npm run build
  ```
- L'archivio sorgente non deve includere `node_modules/` né artefatti di build (`dist/`)
- Il file XPI generato deve corrispondere esattamente a quello caricato

Riferimento policy: https://thunderbird.github.io/atn-review-policy/

---

### Deroga B — Regex per rilevamento URL Jira

Il team Thunderbird preferisce librerie di parsing al posto di regex. La nostra spec ([07-content-script-and-popup.md](07-content-script-and-popup.md)) usa una regex per rilevare URL Jira nel DOM delle email:

```js
const JIRA_LINK_REGEX = /(https?:\/\/[^\s"<>]+\/browse\/([A-Z]+-\d+))/g
```

**Motivazione della deroga:** il pattern è specifico e ben definito (struttura URL Jira `/browse/ISSUEKEY` con chiave nel formato `LETTERE-NUMERO`). Usare una libreria di URL parsing generale sarebbe overengineering per questo caso d'uso. La regex è mantenibile perché corrisponde a un pattern stabile e documentato dell'API Jira.

Questa deroga non si applica ad altri casi: parsing di vCard, iCal, indirizzi email, ecc. devono sempre usare le librerie indicate dal team Thunderbird.

---

## Canali Ufficiali

- **Documentazione:** https://developer.thunderbird.net/
- **Forum:** https://thunderbird.topicbox.com/groups/addons
- **Matrix:** #tb-addon-developers:mozilla.org
- **Esempi ufficiali:** https://github.com/thunderbird/webext-examples
- **Librerie di supporto:** https://github.com/thunderbird/webext-support
