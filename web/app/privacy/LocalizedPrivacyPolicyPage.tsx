"use client";

import Link from "next/link";

import { type LanguageCode } from "@/lib/languages";
import { SiteFooter } from "../components/SiteFooter";
import { useSelectedLanguage } from "../components/useSelectedLanguage";
import {
  AnalyticsConsentControls,
  type AnalyticsConsentControlCopy,
} from "./AnalyticsConsentControls";

type PolicySectionCopy = {
  id: string;
  title: string;
  body: string[];
};

type PrivacyCopy = {
  eyebrow: string;
  title: string;
  lastUpdatedLabel: string;
  lastUpdated: string;
  intro: string;
  highlightsEyebrow: string;
  highlightsTitle: string;
  highlights: string[];
  sections: PolicySectionCopy[];
  contactButton: string;
  contactAria: string;
  returnTitle: string;
  returnBody: string;
  returnButton: string;
  analyticsConsent: AnalyticsConsentControlCopy;
};


const germanPrivacyCopy: PrivacyCopy = {
  eyebrow: "Datenschutzrichtlinie",
  title: "NutsNews Datenschutzrichtlinie",
  lastUpdatedLabel: "Zuletzt aktualisiert",
  lastUpdated: "17. Juli 2026",
  intro:
    "NutsNews ist bewusst einfach und datenschutzfreundlich gebaut: Es ist kein Konto erforderlich, App-Einstellungen werden lokal gespeichert, und die App zeigt positive Zusammenfassungen mit Links zurück zu den Originalverlagen.",
  highlightsEyebrow: "Datenschutz auf einen Blick",
  highlightsTitle: "Klar gestaltet",
  highlights: [
    "Zum Lesen von NutsNews ist kein Konto erforderlich.",
    "Die iOS-App fragt nicht nach Name, E-Mail-Adresse, Telefonnummer, Passwort oder Zahlungsinformationen.",
    "Die iOS-App nutzt keine Berechtigungen für Standort, Kamera, Mikrofon, Fotos, Kontakte oder Gesundheitsdaten.",
    "Die iOS-App enthält keine Werbe-SDKs und keine Funktionen für appübergreifendes Tracking.",
    "Geliktete Geschichten, Designauswahl und Haptik-Einstellungen werden lokal auf dem Gerät gespeichert.",
    "Zwischengespeicherte Artikelantworten verbessern die Geschwindigkeit und reduzieren unnötige Netzwerkanfragen.",
    "Jede Geschichte verweist auf den Originalverlag, statt den vollständigen Artikel erneut zu veröffentlichen.",
  ],
  sections: [
    {
      id: "overview",
      title: "Überblick",
      body: [
        "NutsNews ist ein Reader für positive Nachrichten, der kurze aufbauende Zusammenfassungen zeigt und Leser zu den Originalseiten der Verlage zurückführt.",
        "Diese Richtlinie erklärt, wie NutsNews Informationen in der iOS-App und auf der NutsNews-Website behandelt.",
      ],
    },
    {
      id: "ios-app-does-not-request",
      title: "Informationen, die die iOS-App nicht anfordert",
      body: [
        "Die NutsNews iOS-App erfordert keine Registrierung. Leser können die App öffnen und Geschichten lesen, ohne Name, E-Mail-Adresse, Telefonnummer, Passwort oder Zahlungsinformationen anzugeben.",
        "Die iOS-App verlangt keinen Zugriff auf Standort, Kontakte, Fotos, Kamera, Mikrofon, Kalender, Erinnerungen, Gesundheitsdaten, Bluetooth oder Geräte im lokalen Netzwerk.",
        "Die iOS-App enthält keine Werbefunktionen, keine Anfrage nach einer Werbe-ID und keine Aufforderung zu appübergreifendem Tracking.",
      ],
    },
    {
      id: "local-storage",
      title: "Lokale Speicherung auf dem Gerät",
      body: [
        "Die iOS-App speichert bestimmte Einstellungen lokal auf dem Gerät des Lesers. Dazu gehören ausgewähltes Design, Haptik-Einstellung und Kennungen gelikteter Geschichten.",
        "Geliktete Geschichten werden lokal gespeichert, damit dieselbe Geschichte im Home-Feed und auf der Story-Seite als gelikt erscheint. Diese Information wird nicht an ein NutsNews-Konto gesendet, weil die App keine Konten verlangt.",
        "Leser können ein Like entfernen, indem sie den Like-Button erneut antippen. Lokale App-Daten können auch entfernt werden, indem die App vom Gerät gelöscht wird.",
      ],
    },
    {
      id: "article-feed-caching",
      title: "Caching des Artikel-Feeds",
      body: [
        "Damit die App schneller ist und unnötige Netzwerkanfragen reduziert werden, kann die iOS-App aktuelle Artikel-Feed-Antworten für begrenzte Zeit auf dem Gerät zwischenspeichern.",
        "Der Cache kann Artikeltitel, Zusammenfassungen, Quellennamen, Veröffentlichungsdaten, Kategoriebezeichnungen, Thumbnail-URLs und Original-Publisher-URLs enthalten. Diese Daten dienen Performance und Zuverlässigkeit, nicht der persönlichen Identifizierung von Lesern.",
        "Pull-to-refresh kann frische Geschichten anfordern, und iOS kann Cache-Dateien im Rahmen der normalen Speicherverwaltung löschen.",
      ],
    },
    {
      id: "network-requests",
      title: "Netzwerkanfragen und Serverlogs",
      body: [
        "Wenn die App den Feed lädt, fordert sie Artikeldaten über HTTPS von der NutsNews-Website-API an. Wie bei den meisten Internetdiensten kann diese Anfrage technische Standardinformationen enthalten, etwa IP-Adresse, User-Agent, Anfragezeit, angeforderte URL, Antwortstatus und Performance-Timing.",
        "NutsNews kann übliche Hosting-, Sicherheits-, Logging- und Monitoring-Werkzeuge nutzen, um App und Website zuverlässig zu halten, Missbrauch zu verhindern, Fehler zu verstehen und die Performance zu verbessern.",
        "NutsNews nutzt diese technischen Informationen nicht, um Leser über Apps oder Websites anderer Unternehmen hinweg zu verfolgen, und NutsNews verkauft keine personenbezogenen Informationen.",
      ],
    },
    {
      id: "analytics-diagnostics",
      title: "Website-Analyse und Diagnostik",
      body: [
        "Die NutsNews-Website nutzt Google Analytics 4 nur, wenn Production-Telemetrie live ist, eine Mess-ID konfiguriert ist, der Browser kein Do Not Track oder Global Privacy Control sendet und der Leser minimale Analyse auf dieser Seite erlaubt hat. Standardmäßig ist diese Analyse aus.",
        "Die erlaubte Taxonomie ist absichtlich klein: Standard-Seitenaufrufe, grundlegende Engagement-Signale, grobe Geräte-/Browserklasse, Referrer, ungefährer Standort und Performance-Timing. Wenn minimale Analyse erlaubt ist, kann NutsNews außerdem eigene aggregierte Zähler für ausgehende Artikelklicks und Kategorieinteresse speichern.",
        "Diese Artikel-Engagement-Zähler enthalten nur Event-Typ, Artikel-ID, Quelle und Kategorie. NutsNews sendet dabei keine rohen URLs, Artikeltitel, Referrer, IP-Adressen, User-Agents, Cookies oder Besucherkennungen.",
        "NutsNews definiert keine benutzerdefinierten Analyse-Events für Likes, Suchanfragen, persönliche Profile oder geräteübergreifendes Tracking.",
        "NutsNews sendet keine Namen, E-Mail-Adressen, Konto-IDs, Zahlungsdaten, präzisen Standortdaten, gelikten Geschichten oder KI-Prompts an Analysewerkzeuge. Anzeigenpersonalisierung und Google Signals sind deaktiviert.",
        "Sentry kann Produktionsfehler und Diagnostik erfassen, wenn Production-Telemetrie live ist. Ereignisse werden vor dem Senden bereinigt, damit Cookies, Autorisierungs-Header und andere sensible Header nicht weitergegeben werden.",
        "Die iOS-App ist eine separate native App-Erfahrung. Die aktuelle iOS-App enthält keine Werbe-SDKs, Konto-Login-SDKs oder Social-Login-SDKs Dritter.",
      ],
    },
    {
      id: "publisher-links",
      title: "Links zu Originalverlagen",
      body: [
        "NutsNews verlinkt auf Websites der Originalverlage. Wenn ein Leser eine Originalgeschichte öffnet, kann die Website dieses Verlags Informationen nach der eigenen Datenschutzrichtlinie und Praxis sammeln.",
        "NutsNews ist nicht verantwortlich für Datenschutzpraktiken von Drittanbieter-Verlagsseiten, Werbenetzwerken, Analysewerkzeugen oder eingebetteten Inhalten, die dort erscheinen können.",
      ],
    },
    {
      id: "ai-summaries",
      title: "Artikelinhalte und KI-Zusammenfassungen",
      body: [
        "NutsNews nutzt Artikelmetadaten aus RSS-Feeds und Publisher-Seiten, um positive Geschichten zu erkennen und kurze Zusammenfassungen zu erstellen.",
        "NutsNews veröffentlicht keine urheberrechtlich geschützten vollständigen Artikel erneut. Der Dienst speichert und zeigt Artikelmetadaten, kurze Zusammenfassungen, Quelleninformationen, Thumbnails, Kategorien und Links zurück zu Originalseiten.",
      ],
    },
    {
      id: "children",
      title: "Datenschutz von Kindern",
      body: [
        "NutsNews ist ein Newsreader für ein allgemeines Publikum. App und Website fordern wissentlich keine personenbezogenen Informationen von Kindern an.",
        "Wenn du glaubst, dass ein Kind personenbezogene Informationen an NutsNews übermittelt hat, kontaktiere uns bitte, damit wir die Sache prüfen und behandeln können.",
      ],
    },
    {
      id: "choices",
      title: "Deine Wahlmöglichkeiten",
      body: [
        "Du kannst NutsNews ohne Konto verwenden. Du kannst Likes durch erneutes Tippen entfernen, lokale Einstellungen in den Einstellungen ändern und die App löschen, um lokale App-Daten vom Gerät zu entfernen.",
        "Du kannst die Analyse auf der Website über die Kontrolle auf dieser Seite ausgeschaltet lassen oder minimale Analyse erlauben. Do Not Track und Global Privacy Control werden respektiert und blockieren Analyse weiterhin, selbst wenn die lokale Einstellung Analyse erlaubt.",
        "Du kannst selbst entscheiden, ob du Originalverlagslinks öffnest. Publisher-Websites sind von NutsNews getrennt und können eigene Datenschutzkontrollen haben.",
      ],
    },
    {
      id: "changes",
      title: "Änderungen an dieser Richtlinie",
      body: [
        "Diese Datenschutzrichtlinie kann aktualisiert werden, wenn NutsNews sich verändert. Die neueste Version wird mit aktualisiertem Datum auf dieser Seite veröffentlicht.",
      ],
    },
    {
      id: "contact",
      title: "Kontakt",
      body: [
        "Für Fragen zu dieser Datenschutzrichtlinie, Datenschutzhilfe oder allgemeines Feedback zu NutsNews nutze bitte die Kontaktseite.",
      ],
    },
  ],
  contactButton: "Kontaktseite öffnen",
  contactAria:
    "Die NutsNews-Kontaktseite öffnen, um eine Datenschutzfrage oder Feedback zu senden",
  returnTitle: "Zurück zu NutsNews",
  returnBody:
    "Lies weiter die neuesten positiven Geschichten im NutsNews-Home-Feed.",
  returnButton: "Zurück zur Startseite",
  analyticsConsent: {
    title: "Analyse-Einstellung",
    body: "NutsNews lädt Google Analytics 4 erst, wenn du minimale Analyse erlaubst. Diese Einstellung wird nur in diesem Browser gespeichert.",
    statusLabel: "Aktueller Status",
    statusAllowed: "Minimale Analyse ist erlaubt",
    statusDenied: "Analyse ist ausgeschaltet",
    statusBlocked: "Analyse ist durch Browser-Datenschutzsignale blockiert",
    allowButton: "Minimale Analyse erlauben",
    denyButton: "Analyse ausgeschaltet lassen",
  },
};

const greekPrivacyCopy: PrivacyCopy = {
  eyebrow: "Πολιτική απορρήτου",
  title: "Πολιτική απορρήτου NutsNews",
  lastUpdatedLabel: "Τελευταία ενημέρωση",
  lastUpdated: "17 Ιουλίου 2026",
  intro:
    "Το NutsNews είναι φτιαγμένο ώστε να είναι απλό και προσεκτικό με το απόρρητο: δεν απαιτείται λογαριασμός, οι προτιμήσεις της εφαρμογής αποθηκεύονται τοπικά και η εφαρμογή εστιάζει σε θετικές περιλήψεις ιστοριών με συνδέσμους προς τους αρχικούς εκδότες.",
  highlightsEyebrow: "Σημεία απορρήτου",
  highlightsTitle: "Καθαρό από τον σχεδιασμό",
  highlights: [
    "Δεν απαιτείται λογαριασμός για να περιηγηθείτε στο NutsNews.",
    "Η iOS εφαρμογή δεν ζητά όνομα, email, αριθμό τηλεφώνου, κωδικό ή στοιχεία πληρωμής.",
    "Η iOS εφαρμογή δεν χρησιμοποιεί άδειες για τοποθεσία, κάμερα, μικρόφωνο, φωτογραφίες, επαφές ή δεδομένα υγείας.",
    "Η iOS εφαρμογή δεν περιλαμβάνει διαφημιστικά SDK ή λειτουργίες cross-app tracking.",
    "Οι αγαπημένες ιστορίες, οι επιλογές θέματος και οι προτιμήσεις haptics αποθηκεύονται τοπικά στη συσκευή.",
    "Οι cached απαντήσεις άρθρων βελτιώνουν την ταχύτητα και μειώνουν τις περιττές δικτυακές αιτήσεις.",
    "Κάθε ιστορία συνδέει πίσω στον αρχικό εκδότη αντί να αναδημοσιεύει ολόκληρο το άρθρο.",
  ],
  sections: [
    {
      id: "overview",
      title: "Επισκόπηση",
      body: [
        "Το NutsNews είναι ένας reader θετικών ειδήσεων που εμφανίζει σύντομες ενθαρρυντικές περιλήψεις και στέλνει τους αναγνώστες πίσω στους αρχικούς ιστότοπους των εκδοτών.",
        "Αυτή η πολιτική εξηγεί πώς το NutsNews χειρίζεται πληροφορίες στην iOS εφαρμογή και στον ιστότοπο NutsNews.",
      ],
    },
    {
      id: "ios-app-does-not-request",
      title: "Πληροφορίες που δεν ζητά η iOS εφαρμογή",
      body: [
        "Η iOS εφαρμογή NutsNews δεν απαιτεί εγγραφή λογαριασμού. Οι αναγνώστες μπορούν να ανοίξουν την εφαρμογή και να περιηγηθούν χωρίς να δώσουν όνομα, email, τηλέφωνο, κωδικό ή στοιχεία πληρωμής.",
        "Η iOS εφαρμογή δεν ζητά πρόσβαση σε τοποθεσία, επαφές, φωτογραφίες, κάμερα, μικρόφωνο, ημερολόγια, υπενθυμίσεις, δεδομένα υγείας, Bluetooth ή συσκευές τοπικού δικτύου.",
        "Η iOS εφαρμογή δεν περιλαμβάνει διαφημιστικές λειτουργίες, αίτημα advertising identifier ή προτροπή cross-app tracking.",
      ],
    },
    {
      id: "local-storage",
      title: "Τοπική αποθήκευση στη συσκευή",
      body: [
        "Η iOS εφαρμογή αποθηκεύει ορισμένες προτιμήσεις τοπικά στη συσκευή του αναγνώστη, όπως το επιλεγμένο θέμα, την προτίμηση haptics και τα αναγνωριστικά των αγαπημένων ιστοριών.",
        "Οι αγαπημένες ιστορίες αποθηκεύονται τοπικά ώστε η ίδια ιστορία να εμφανίζεται ως αγαπημένη στη ροή και στη σελίδα ιστορίας. Αυτή η πληροφορία δεν αποστέλλεται σε λογαριασμό NutsNews, επειδή η εφαρμογή δεν απαιτεί λογαριασμούς.",
        "Οι αναγνώστες μπορούν να αφαιρέσουν ένα like πατώντας ξανά το κουμπί. Μπορούν επίσης να αφαιρέσουν τα τοπικά δεδομένα διαγράφοντας την εφαρμογή από τη συσκευή.",
      ],
    },
    {
      id: "article-feed-caching",
      title: "Caching ροής άρθρων",
      body: [
        "Για μεγαλύτερη ταχύτητα και λιγότερες περιττές δικτυακές αιτήσεις, η iOS εφαρμογή μπορεί να αποθηκεύει προσωρινά πρόσφατες απαντήσεις της ροής άρθρων στη συσκευή για περιορισμένο χρόνο.",
        "Το cache μπορεί να περιλαμβάνει τίτλους, περιλήψεις, ονόματα πηγών, ημερομηνίες δημοσίευσης, ετικέτες κατηγοριών, thumbnail URLs και αρχικά publisher URLs. Αυτά τα δεδομένα χρησιμοποιούνται για απόδοση και αξιοπιστία, όχι για προσωπική ταυτοποίηση αναγνωστών.",
        "Το pull-to-refresh μπορεί να ζητήσει νέες ιστορίες, και το iOS μπορεί να καθαρίσει cached αρχεία στο πλαίσιο της κανονικής διαχείρισης αποθήκευσης.",
      ],
    },
    {
      id: "network-requests",
      title: "Δικτυακές αιτήσεις και server logs",
      body: [
        "Όταν η εφαρμογή φορτώνει τη ροή, ζητά δεδομένα άρθρων από το NutsNews website API μέσω HTTPS. Όπως οι περισσότερες διαδικτυακές υπηρεσίες, αυτή η αίτηση μπορεί να περιλαμβάνει τυπικές τεχνικές πληροφορίες όπως IP address, user agent, ώρα αιτήματος, ζητούμενο URL, status απόκρισης και χρόνους απόδοσης.",
        "Το NutsNews μπορεί να χρησιμοποιεί συνηθισμένα εργαλεία hosting, ασφάλειας, logging και monitoring για αξιοπιστία, πρόληψη κατάχρησης, κατανόηση σφαλμάτων και βελτίωση απόδοσης.",
        "Το NutsNews δεν χρησιμοποιεί αυτές τις τεχνικές πληροφορίες για να παρακολουθεί αναγνώστες σε apps ή websites άλλων εταιρειών και δεν πουλά προσωπικές πληροφορίες.",
      ],
    },
    {
      id: "analytics-diagnostics",
      title: "Analytics και diagnostics ιστότοπου",
      body: [
        "Ο ιστότοπος NutsNews χρησιμοποιεί Google Analytics 4 μόνο όταν η παραγωγική τηλεμετρία είναι live, υπάρχει ρυθμισμένο measurement ID, ο browser δεν στέλνει Do Not Track ή Global Privacy Control και ο αναγνώστης έχει επιτρέψει ελάχιστα analytics σε αυτή τη σελίδα. Η προεπιλογή είναι off.",
        "Η επιτρεπόμενη ταξινόμηση είναι σκόπιμα μικρή: τυπικά page views, βασικά engagement signals, χονδρική κατηγορία συσκευής/browser, referrer, κατά προσέγγιση περιοχή και performance timing. Όταν επιτρέπονται ελάχιστα analytics, το NutsNews μπορεί επίσης να αποθηκεύει δικούς του συγκεντρωτικούς μετρητές για outbound κλικ άρθρων και ενδιαφέρον κατηγορίας.",
        "Αυτοί οι μετρητές article engagement περιέχουν μόνο τύπο event, article ID, πηγή και κατηγορία. Το NutsNews δεν στέλνει raw URLs, τίτλους άρθρων, referrers, IP addresses, user agents, cookies ή visitor identifiers.",
        "Το NutsNews δεν ορίζει custom analytics events για likes, αναζητήσεις, προσωπικά profiles ή cross-device tracking.",
        "Το NutsNews δεν στέλνει ονόματα, email, account IDs, στοιχεία πληρωμής, ακριβή τοποθεσία, αγαπημένες ιστορίες ή AI prompts σε analytics tools. Το ad personalization και τα Google Signals είναι απενεργοποιημένα.",
        "Το Sentry μπορεί να συλλέγει production errors και diagnostics όταν η παραγωγική τηλεμετρία είναι live. Τα events καθαρίζονται πριν την αποστολή ώστε cookies, authorization headers και άλλα ευαίσθητα headers να μην αποστέλλονται.",
        "Η iOS εφαρμογή είναι ξεχωριστή native εμπειρία. Η τρέχουσα iOS εφαρμογή δεν περιλαμβάνει διαφημιστικά SDK, account login SDKs ή third-party social login SDKs.",
      ],
    },
    {
      id: "publisher-links",
      title: "Σύνδεσμοι προς αρχικούς εκδότες",
      body: [
        "Το NutsNews συνδέει σε αρχικούς ιστότοπους εκδοτών. Όταν ένας αναγνώστης ανοίγει μια αρχική ιστορία, ο ιστότοπος του εκδότη μπορεί να συλλέγει πληροφορίες σύμφωνα με τη δική του πολιτική απορρήτου και πρακτικές.",
        "Το NutsNews δεν είναι υπεύθυνο για πρακτικές απορρήτου τρίτων εκδοτών, διαφημιστικών δικτύων, analytics tools ή ενσωματωμένου περιεχομένου που μπορεί να εμφανίζεται σε αυτούς τους ιστότοπους.",
      ],
    },
    {
      id: "ai-summaries",
      title: "Περιεχόμενο άρθρων και περιλήψεις AI",
      body: [
        "Το NutsNews χρησιμοποιεί μεταδεδομένα άρθρων από RSS feeds και σελίδες εκδοτών για να εντοπίζει θετικές ιστορίες και να δημιουργεί σύντομες περιλήψεις.",
        "Το NutsNews δεν αναδημοσιεύει ολόκληρα copyrighted άρθρα. Η υπηρεσία αποθηκεύει και εμφανίζει μεταδεδομένα άρθρων, σύντομες περιλήψεις, πληροφορίες πηγής, thumbnails, κατηγορίες και links πίσω στις αρχικές σελίδες των εκδοτών.",
      ],
    },
    {
      id: "children",
      title: "Απόρρητο παιδιών",
      body: [
        "Το NutsNews είναι news reader για γενικό κοινό. Η εφαρμογή και ο ιστότοπος δεν ζητούν εν γνώσει τους προσωπικές πληροφορίες από παιδιά.",
        "Αν πιστεύετε ότι ένα παιδί έδωσε προσωπικές πληροφορίες στο NutsNews, επικοινωνήστε μαζί μας ώστε να το εξετάσουμε και να το αντιμετωπίσουμε.",
      ],
    },
    {
      id: "choices",
      title: "Οι επιλογές σας",
      body: [
        "Μπορείτε να χρησιμοποιήσετε το NutsNews χωρίς λογαριασμό. Μπορείτε να αφαιρέσετε likes πατώντας ξανά το κουμπί, να αλλάξετε τοπικές προτιμήσεις στις Ρυθμίσεις και να διαγράψετε την εφαρμογή για να αφαιρέσετε τοπικά δεδομένα από τη συσκευή.",
        "Μπορείτε να αφήσετε τα website analytics απενεργοποιημένα ή να επιτρέψετε ελάχιστα analytics από το control αυτής της σελίδας. Το Do Not Track και το Global Privacy Control γίνονται σεβαστά και συνεχίζουν να μπλοκάρουν analytics, ακόμη και αν η τοπική ρύθμιση τα επιτρέπει.",
        "Μπορείτε να επιλέξετε αν θα ανοίγετε links αρχικών εκδοτών. Οι ιστότοποι εκδοτών είναι ξεχωριστοί από το NutsNews και μπορεί να έχουν δικούς τους ελέγχους απορρήτου.",
      ],
    },
    {
      id: "changes",
      title: "Αλλαγές σε αυτή την πολιτική",
      body: [
        "Αυτή η πολιτική απορρήτου μπορεί να ενημερώνεται καθώς αλλάζει το NutsNews. Η πιο πρόσφατη έκδοση θα δημοσιεύεται σε αυτή τη σελίδα με ενημερωμένη ημερομηνία.",
      ],
    },
    {
      id: "contact",
      title: "Επικοινωνία",
      body: [
        "Για ερωτήσεις σχετικά με αυτή την πολιτική απορρήτου, βοήθεια απορρήτου ή γενικά σχόλια για το NutsNews, χρησιμοποιήστε τη σελίδα επικοινωνίας.",
      ],
    },
  ],
  contactButton: "Άνοιγμα σελίδας επικοινωνίας",
  contactAria:
    "Άνοιγμα της σελίδας επικοινωνίας NutsNews για αποστολή ερώτησης απορρήτου ή σχολίων",
  returnTitle: "Επιστροφή στο NutsNews",
  returnBody:
    "Συνεχίστε να διαβάζετε τις πιο πρόσφατες θετικές ιστορίες στη ροή της αρχικής σελίδας του NutsNews.",
  returnButton: "Πίσω στην αρχική",
  analyticsConsent: {
    title: "Ρύθμιση analytics",
    body: "Το NutsNews φορτώνει το Google Analytics 4 μόνο αφού επιτρέψετε ελάχιστα analytics. Αυτή η επιλογή αποθηκεύεται μόνο σε αυτόν τον browser.",
    statusLabel: "Τρέχουσα κατάσταση",
    statusAllowed: "Τα ελάχιστα analytics επιτρέπονται",
    statusDenied: "Τα analytics είναι απενεργοποιημένα",
    statusBlocked: "Τα analytics μπλοκάρονται από σήματα απορρήτου του browser",
    allowButton: "Επιτρέψτε ελάχιστα analytics",
    denyButton: "Κρατήστε τα analytics off",
  },
};

export const privacyCopyByLanguage: Record<LanguageCode, PrivacyCopy> = {
  "de-CH": germanPrivacyCopy,
  de: germanPrivacyCopy,
  el: greekPrivacyCopy,
  en: {
    eyebrow: "Privacy Policy",
    title: "NutsNews Privacy Policy",
    lastUpdatedLabel: "Last updated",
    lastUpdated: "July 17, 2026",
    intro:
      "NutsNews is built to be simple and privacy-conscious: no account is required, app preferences are stored locally, and the app focuses on showing positive story summaries with links back to original publishers.",
    highlightsEyebrow: "Privacy highlights",
    highlightsTitle: "Clear by design",
    highlights: [
      "No account is required to browse NutsNews.",
      "The iOS app does not ask for a name, email address, phone number, password, or payment information.",
      "The iOS app does not use location, camera, microphone, photos, contacts, or health data permissions.",
      "The iOS app does not include advertising SDKs or cross-app tracking features.",
      "Liked stories, theme choices, and haptics preferences are stored locally on the device.",
      "Cached article responses are used to improve speed and reduce unnecessary network requests.",
      "Every story links back to the original publisher instead of republishing the full article.",
    ],
    sections: [
      {
        id: "overview",
        title: "Overview",
        body: [
          "NutsNews is a positive news reader that shows short uplifting summaries and links readers back to original publisher websites.",
          "This policy explains how NutsNews handles information in the iOS app and on the NutsNews website.",
        ],
      },
      {
        id: "ios-app-does-not-request",
        title: "Information the iOS app does not request",
        body: [
          "The NutsNews iOS app does not require account registration. Readers can open the app and browse stories without providing a name, email address, phone number, password, or payment information.",
          "The iOS app does not request access to location, contacts, photos, camera, microphone, calendars, reminders, health data, Bluetooth, or local network devices.",
          "The iOS app does not include advertising features, an advertising identifier request, or a cross-app tracking prompt.",
        ],
      },
      {
        id: "local-storage",
        title: "Local device storage",
        body: [
          "The iOS app stores certain preferences locally on the reader's device. This includes selected app theme, haptics preference, and liked-story identifiers.",
          "Liked stories are saved locally so the same story can appear as liked on both the home feed and story page. This liked-story information is not sent to a NutsNews account because the app does not require accounts.",
          "Readers can remove a liked story by tapping the like button again. Readers can also remove local app data by deleting the app from their device.",
        ],
      },
      {
        id: "article-feed-caching",
        title: "Article feed caching",
        body: [
          "To make the app faster and reduce unnecessary network requests, the iOS app may cache recent article feed responses on the device for a limited time.",
          "The cache can include article titles, summaries, source names, publish dates, category labels, thumbnail URLs, and original publisher URLs. This cached article data is used for app performance and reliability, not to personally identify readers.",
          "Pull-to-refresh can request fresh stories, and iOS may clear cached files as part of normal device storage management.",
        ],
      },
      {
        id: "network-requests",
        title: "Network requests and server logs",
        body: [
          "When the app loads the feed, it requests article data from the NutsNews website API over HTTPS. Like most internet services, this request may include standard technical information such as IP address, user agent, request time, URL requested, response status, and performance timing.",
          "NutsNews may use standard hosting, security, logging, and monitoring tools to keep the app and website reliable, prevent abuse, understand errors, and improve performance.",
          "NutsNews does not use this technical information to track readers across other companies' apps or websites, and NutsNews does not sell personal information.",
        ],
      },
      {
        id: "analytics-diagnostics",
        title: "Website analytics and diagnostics",
        body: [
          "The NutsNews website uses Google Analytics 4 only when production telemetry is live, a measurement ID is configured, the browser is not sending Do Not Track or Global Privacy Control, and the reader has allowed minimal analytics on this page. The default is off.",
          "The allowed taxonomy is intentionally small: standard page views, basic engagement signals, coarse device/browser class, referrer, approximate region, and performance timing. When minimal analytics is allowed, NutsNews may also record first-party aggregate counters for outbound article clicks and category interest.",
          "These article engagement counters include only event type, article ID, source, and category. NutsNews does not send raw URLs, article titles, referrers, IP addresses, user agents, cookies, or visitor identifiers with those events.",
          "NutsNews does not define custom analytics events for likes, searches, personal profiles, or cross-device tracking.",
          "NutsNews does not send names, email addresses, account IDs, payment details, precise location, liked stories, or AI prompts to analytics tools. Advertising personalization and Google Signals are disabled.",
          "Sentry may collect production errors and diagnostics when production telemetry is live. Events are scrubbed before sending so cookies, authorization headers, and other sensitive headers are not forwarded.",
          "The iOS app is a separate native app experience. The current iOS app does not include advertising SDKs, account login SDKs, or third-party social login SDKs.",
        ],
      },
      {
        id: "publisher-links",
        title: "Original publisher links",
        body: [
          "NutsNews links to original publisher websites. When a reader opens an original story, that publisher's website may collect information according to its own privacy policy and practices.",
          "NutsNews is not responsible for the privacy practices of third-party publisher websites, advertising networks, analytics tools, or embedded content that may appear on those publisher websites.",
        ],
      },
      {
        id: "ai-summaries",
        title: "Article content and AI summaries",
        body: [
          "NutsNews uses article metadata from RSS feeds and publisher pages to help identify positive stories and create short summaries.",
          "NutsNews does not republish full copyrighted articles. The service stores and displays article metadata, short summaries, source information, thumbnails, categories, and links back to original publisher pages.",
        ],
      },
      {
        id: "children",
        title: "Children's privacy",
        body: [
          "NutsNews is a general-audience news reader. The app and website do not knowingly request personal information from children.",
          "If you believe a child has provided personal information to NutsNews, please contact us so we can review and address the issue.",
        ],
      },
      {
        id: "choices",
        title: "Your choices",
        body: [
          "You can use NutsNews without creating an account. You can unlike stories by tapping the like button again, change local preferences in Settings, and delete the app to remove local app data from your device.",
          "You can keep website analytics off or allow minimal analytics using the control on this page. Do Not Track and Global Privacy Control are respected and continue to block analytics even if the local setting allows analytics.",
          "You can choose whether to open original publisher links. Publisher websites are separate from NutsNews and may have their own privacy controls.",
        ],
      },
      {
        id: "changes",
        title: "Changes to this policy",
        body: [
          "This privacy policy may be updated as NutsNews changes. The latest version will be posted on this page with an updated date.",
        ],
      },
      {
        id: "contact",
        title: "Contact",
        body: [
          "To ask questions about this privacy policy, request privacy help, or send general NutsNews feedback, please use the contact page.",
        ],
      },
    ],
    contactButton: "Open the contact page",
    contactAria:
      "Open the NutsNews contact page to send a privacy question or feedback message",
    returnTitle: "Return to NutsNews",
    returnBody:
      "Continue browsing the latest uplifting stories on the NutsNews home feed.",
    returnButton: "Back to home",
    analyticsConsent: {
      title: "Analytics setting",
      body: "NutsNews loads Google Analytics 4 only after you allow minimal analytics. This choice is stored only in this browser.",
      statusLabel: "Current status",
      statusAllowed: "Minimal analytics is allowed",
      statusDenied: "Analytics is off",
      statusBlocked: "Analytics is blocked by browser privacy signals",
      allowButton: "Allow minimal analytics",
      denyButton: "Keep analytics off",
    },
  },
  fr: {
    eyebrow: "Politique de confidentialité",
    title: "Politique de confidentialité de NutsNews",
    lastUpdatedLabel: "Dernière mise à jour",
    lastUpdated: "17 juillet 2026",
    intro:
      "NutsNews est conçu pour être simple et respectueux de la vie privée : aucun compte n’est requis, les préférences de l’app sont stockées localement, et l’app se concentre sur des résumés d’histoires positives avec des liens vers les éditeurs d’origine.",
    highlightsEyebrow: "Points clés de confidentialité",
    highlightsTitle: "Clair par conception",
    highlights: [
      "Aucun compte n’est requis pour parcourir NutsNews.",
      "L’app iOS ne demande pas de nom, d’adresse email, de numéro de téléphone, de mot de passe ni d’informations de paiement.",
      "L’app iOS n’utilise pas les permissions de localisation, caméra, microphone, photos, contacts ou données de santé.",
      "L’app iOS n’inclut pas de SDK publicitaire ni de fonctions de suivi entre apps.",
      "Les histoires aimées, les choix de thème et les préférences haptiques sont stockés localement sur l’appareil.",
      "Les réponses d’articles mises en cache améliorent la vitesse et réduisent les requêtes réseau inutiles.",
      "Chaque histoire renvoie vers l’éditeur d’origine au lieu de republier l’article complet.",
    ],
    sections: [
      {
        id: "overview",
        title: "Aperçu",
        body: [
          "NutsNews est un lecteur de nouvelles positives qui affiche de courts résumés encourageants et renvoie les lecteurs vers les sites des éditeurs d’origine.",
          "Cette politique explique comment NutsNews traite les informations dans l’app iOS et sur le site NutsNews.",
        ],
      },
      {
        id: "ios-app-does-not-request",
        title: "Informations que l’app iOS ne demande pas",
        body: [
          "L’app iOS NutsNews ne nécessite pas d’inscription. Les lecteurs peuvent ouvrir l’app et parcourir les histoires sans fournir de nom, d’adresse email, de numéro de téléphone, de mot de passe ni d’informations de paiement.",
          "L’app iOS ne demande pas l’accès à la localisation, aux contacts, aux photos, à la caméra, au microphone, aux calendriers, rappels, données de santé, Bluetooth ou appareils du réseau local.",
          "L’app iOS n’inclut pas de fonctions publicitaires, de demande d’identifiant publicitaire ou d’invite de suivi entre apps.",
        ],
      },
      {
        id: "local-storage",
        title: "Stockage local sur l’appareil",
        body: [
          "L’app iOS stocke certaines préférences localement sur l’appareil du lecteur, notamment le thème choisi, la préférence haptique et les identifiants des histoires aimées.",
          "Les histoires aimées sont enregistrées localement pour apparaître comme aimées dans le fil d’accueil et sur la page de l’histoire. Cette information n’est pas envoyée à un compte NutsNews, car l’app ne nécessite pas de compte.",
          "Les lecteurs peuvent retirer un like en appuyant à nouveau sur le bouton. Ils peuvent aussi supprimer les données locales en supprimant l’app de leur appareil.",
        ],
      },
      {
        id: "article-feed-caching",
        title: "Mise en cache du fil d’articles",
        body: [
          "Pour rendre l’app plus rapide et réduire les requêtes réseau inutiles, l’app iOS peut mettre en cache les réponses récentes du fil d’articles sur l’appareil pendant une durée limitée.",
          "Le cache peut inclure les titres, résumés, noms de sources, dates de publication, catégories, URLs de miniatures et URLs des éditeurs d’origine. Ces données servent à la performance et à la fiabilité de l’app, pas à identifier personnellement les lecteurs.",
          "Le geste de rafraîchissement peut demander de nouvelles histoires, et iOS peut effacer les fichiers mis en cache dans le cadre de la gestion normale du stockage.",
        ],
      },
      {
        id: "network-requests",
        title: "Requêtes réseau et journaux serveur",
        body: [
          "Quand l’app charge le fil, elle demande les données d’articles à l’API du site NutsNews via HTTPS. Comme la plupart des services Internet, cette requête peut inclure des informations techniques standard comme l’adresse IP, l’agent utilisateur, l’heure de la requête, l’URL demandée, le statut de réponse et les temps de performance.",
          "NutsNews peut utiliser des outils standard d’hébergement, de sécurité, de journalisation et de surveillance pour maintenir l’app et le site fiables, prévenir les abus, comprendre les erreurs et améliorer les performances.",
          "NutsNews n’utilise pas ces informations techniques pour suivre les lecteurs sur les apps ou sites d’autres entreprises, et NutsNews ne vend pas les informations personnelles.",
        ],
      },
      {
        id: "analytics-diagnostics",
        title: "Analyses et diagnostics du site",
        body: [
          "Le site NutsNews utilise Google Analytics 4 uniquement lorsque la télémétrie de production est active, qu’un identifiant de mesure est configuré, que le navigateur n’envoie pas Do Not Track ou Global Privacy Control et que le lecteur a autorisé une analyse minimale sur cette page. Par défaut, cette analyse est désactivée.",
          "La taxonomie autorisée est volontairement limitée : vues de page standard, signaux d’engagement de base, catégorie générale d’appareil ou de navigateur, référent, région approximative et mesures de performance. Lorsque l’analyse minimale est autorisée, NutsNews peut aussi enregistrer des compteurs agrégés internes pour les clics sortants d’articles et l’intérêt par catégorie.",
          "Ces compteurs d’engagement d’article contiennent seulement le type d’événement, l’ID d’article, la source et la catégorie. NutsNews n’envoie pas d’URLs brutes, de titres d’articles, de référents, d’adresses IP, d’agents utilisateur, de cookies ni d’identifiants de visiteur avec ces événements.",
          "NutsNews ne définit pas d’événements d’analyse personnalisés pour les likes, les recherches, les profils personnels ou le suivi entre appareils.",
          "NutsNews n’envoie pas aux outils d’analyse les noms, adresses e-mail, identifiants de compte, données de paiement, localisation précise, histoires aimées ou prompts d’IA. La personnalisation publicitaire et Google Signals sont désactivés.",
          "Sentry peut collecter des erreurs et diagnostics de production lorsque la télémétrie de production est active. Les événements sont nettoyés avant l’envoi afin que les cookies, en-têtes d’autorisation et autres en-têtes sensibles ne soient pas transmis.",
          "L’app iOS est une expérience native séparée. L’app iOS actuelle n’inclut pas de SDK publicitaire, de SDK de connexion de compte ni de SDK de connexion sociale tiers.",
        ],
      },
      {
        id: "publisher-links",
        title: "Liens vers les éditeurs d’origine",
        body: [
          "NutsNews renvoie vers les sites des éditeurs d’origine. Quand un lecteur ouvre une histoire originale, le site de cet éditeur peut collecter des informations selon sa propre politique de confidentialité et ses pratiques.",
          "NutsNews n’est pas responsable des pratiques de confidentialité des sites d’éditeurs tiers, réseaux publicitaires, outils d’analyse ou contenus intégrés pouvant apparaître sur ces sites.",
        ],
      },
      {
        id: "ai-summaries",
        title: "Contenu d’articles et résumés IA",
        body: [
          "NutsNews utilise les métadonnées d’articles provenant de flux RSS et de pages d’éditeurs pour identifier des histoires positives et créer de courts résumés.",
          "NutsNews ne republie pas les articles protégés dans leur intégralité. Le service stocke et affiche des métadonnées d’articles, de courts résumés, les sources, miniatures, catégories et liens vers les pages des éditeurs d’origine.",
        ],
      },
      {
        id: "children",
        title: "Confidentialité des enfants",
        body: [
          "NutsNews est un lecteur de nouvelles destiné au grand public. L’app et le site ne demandent pas sciemment d’informations personnelles aux enfants.",
          "Si vous pensez qu’un enfant a fourni des informations personnelles à NutsNews, contactez-nous afin que nous puissions examiner et traiter le problème.",
        ],
      },
      {
        id: "choices",
        title: "Vos choix",
        body: [
          "Vous pouvez utiliser NutsNews sans créer de compte. Vous pouvez retirer un like en appuyant à nouveau sur le bouton, changer les préférences locales dans les paramètres et supprimer l’app pour retirer les données locales de votre appareil.",
          "Vous pouvez garder l’analyse du site désactivée ou autoriser une analyse minimale avec le contrôle de cette page. Do Not Track et Global Privacy Control sont respectés et continuent de bloquer l’analyse même si le réglage local l’autorise.",
          "Vous pouvez choisir d’ouvrir ou non les liens des éditeurs d’origine. Les sites des éditeurs sont séparés de NutsNews et peuvent avoir leurs propres contrôles de confidentialité.",
        ],
      },
      {
        id: "changes",
        title: "Modifications de cette politique",
        body: [
          "Cette politique de confidentialité peut être mise à jour lorsque NutsNews évolue. La dernière version sera publiée sur cette page avec une date de mise à jour.",
        ],
      },
      {
        id: "contact",
        title: "Contact",
        body: [
          "Pour poser des questions sur cette politique, demander de l’aide concernant la confidentialité ou envoyer un commentaire général à NutsNews, veuillez utiliser la page de contact.",
        ],
      },
    ],
    contactButton: "Ouvrir la page de contact",
    contactAria:
      "Ouvrir la page de contact NutsNews pour envoyer une question de confidentialité ou un commentaire",
    returnTitle: "Retour à NutsNews",
    returnBody:
      "Continuez à parcourir les dernières histoires positives sur le fil d’accueil NutsNews.",
    returnButton: "Retour à l’accueil",
    analyticsConsent: {
      title: "Réglage d’analyse",
      body: "NutsNews charge Google Analytics 4 uniquement après votre autorisation d’une analyse minimale. Ce choix est enregistré seulement dans ce navigateur.",
      statusLabel: "État actuel",
      statusAllowed: "L’analyse minimale est autorisée",
      statusDenied: "L’analyse est désactivée",
      statusBlocked: "L’analyse est bloquée par les signaux de confidentialité du navigateur",
      allowButton: "Autoriser l’analyse minimale",
      denyButton: "Garder l’analyse désactivée",
    },
  },
  ja: {
    eyebrow: "プライバシーポリシー",
    title: "NutsNews プライバシーポリシー",
    lastUpdatedLabel: "最終更新日",
    lastUpdated: "2026年7月17日",
    intro:
      "NutsNewsは、シンプルでプライバシーに配慮した作りを目指しています。アカウントは不要で、アプリの設定はローカルに保存され、前向きなストーリーの要約と元の出版社へのリンクを表示することに集中しています。",
    highlightsEyebrow: "プライバシーのポイント",
    highlightsTitle: "わかりやすさを前提に設計",
    highlights: [
      "NutsNewsを閲覧するためにアカウントは必要ありません。",
      "iOSアプリは、名前、メールアドレス、電話番号、パスワード、支払い情報を求めません。",
      "iOSアプリは、位置情報、カメラ、マイク、写真、連絡先、健康データの権限を使用しません。",
      "iOSアプリには広告SDKやアプリ横断トラッキング機能は含まれていません。",
      "いいねしたストーリー、テーマ選択、ハプティクス設定は端末内に保存されます。",
      "キャッシュされた記事レスポンスは、速度を上げ、不要なネットワーク要求を減らすために使われます。",
      "すべてのストーリーは、全文を再掲載するのではなく、元の出版社へリンクします。",
    ],
    sections: [
      {
        id: "overview",
        title: "概要",
        body: [
          "NutsNewsは、短い前向きな要約を表示し、読者を元の出版社サイトへ戻すポジティブニュースリーダーです。",
          "このポリシーは、NutsNewsがiOSアプリとNutsNewsサイトで情報をどのように扱うかを説明します。",
        ],
      },
      {
        id: "ios-app-does-not-request",
        title: "iOSアプリが求めない情報",
        body: [
          "NutsNews iOSアプリはアカウント登録を必要としません。読者は名前、メールアドレス、電話番号、パスワード、支払い情報を提供せずにアプリを開き、ストーリーを閲覧できます。",
          "iOSアプリは、位置情報、連絡先、写真、カメラ、マイク、カレンダー、リマインダー、健康データ、Bluetooth、ローカルネットワーク機器へのアクセスを求めません。",
          "iOSアプリには、広告機能、広告識別子の要求、アプリ横断トラッキングのプロンプトは含まれていません。",
        ],
      },
      {
        id: "local-storage",
        title: "端末内のローカル保存",
        body: [
          "iOSアプリは、選択したアプリテーマ、ハプティクス設定、いいねしたストーリーの識別子など、一部の設定を読者の端末にローカル保存します。",
          "いいねしたストーリーは、ホームフィードとストーリーページの両方で同じストーリーがいいね済みに見えるよう、ローカルに保存されます。アプリはアカウントを必要としないため、この情報はNutsNewsアカウントへ送信されません。",
          "読者はいいねボタンをもう一度押して、いいねを外せます。アプリを削除することで端末内のローカルデータも削除できます。",
        ],
      },
      {
        id: "article-feed-caching",
        title: "記事フィードのキャッシュ",
        body: [
          "アプリを速くし、不要なネットワーク要求を減らすため、iOSアプリは最近の記事フィードのレスポンスを端末上に一定期間キャッシュすることがあります。",
          "キャッシュには、記事タイトル、要約、ソース名、公開日、カテゴリーラベル、サムネイルURL、元の出版社URLが含まれることがあります。このキャッシュされた記事データは、アプリの性能と信頼性のために使われ、読者を個人的に識別するためには使われません。",
          "プルして更新すると新しいストーリーを要求できます。また、iOSは通常のストレージ管理の一環としてキャッシュファイルを消去することがあります。",
        ],
      },
      {
        id: "network-requests",
        title: "ネットワーク要求とサーバーログ",
        body: [
          "アプリがフィードを読み込むとき、HTTPS経由でNutsNewsサイトAPIに記事データを要求します。多くのインターネットサービスと同様に、この要求にはIPアドレス、ユーザーエージェント、要求時刻、要求URL、応答ステータス、パフォーマンス時間などの標準的な技術情報が含まれることがあります。",
          "NutsNewsは、アプリとサイトの信頼性を保ち、不正利用を防ぎ、エラーを理解し、パフォーマンスを改善するために、標準的なホスティング、セキュリティ、ログ、監視ツールを使うことがあります。",
          "NutsNewsは、これらの技術情報を使って他社のアプリやサイトで読者を追跡することはなく、個人情報を販売することもありません。",
        ],
      },
      {
        id: "analytics-diagnostics",
        title: "ウェブサイトの分析と診断",
        body: [
          "NutsNewsサイトは、本番テレメトリーが有効で、測定IDが設定され、ブラウザがDo Not TrackまたはGlobal Privacy Controlを送信しておらず、このページで読者が最小限の分析を許可した場合にのみGoogle Analytics 4を使用します。初期状態ではオフです。",
          "許可される分類は意図的に小さくしています。標準のページビュー、基本的なエンゲージメント信号、大まかな端末またはブラウザ種別、参照元、おおよその地域、パフォーマンスタイミングに限ります。読者が最小限の分析を許可した場合、NutsNewsは記事の外部リンククリックとカテゴリー関心について、自社の集計カウンターを記録することがあります。",
          "これらの記事エンゲージメントカウンターに含まれるのは、イベント種別、記事ID、ソース、カテゴリーだけです。NutsNewsは、これらのイベントで生のURL、記事タイトル、参照元、IPアドレス、ユーザーエージェント、Cookie、訪問者識別子を送信しません。",
          "NutsNewsは、いいね、検索、個人プロフィール、デバイス横断トラッキングのためのカスタム分析イベントを定義しません。",
          "NutsNewsは、名前、メールアドレス、アカウントID、支払い情報、正確な位置情報、いいねしたストーリー、AIプロンプトを分析ツールに送信しません。広告パーソナライズとGoogle Signalsは無効です。",
          "本番テレメトリーが有効な場合、Sentryが本番エラーと診断情報を収集することがあります。送信前にイベントを整理し、Cookie、認可ヘッダー、その他の機密ヘッダーを転送しないようにします。",
          "iOSアプリは別のネイティブアプリ体験です。現在のiOSアプリには、広告SDK、アカウントログインSDK、第三者ソーシャルログインSDKは含まれていません。",
        ],
      },
      {
        id: "publisher-links",
        title: "元の出版社へのリンク",
        body: [
          "NutsNewsは元の出版社サイトへリンクします。読者が元のストーリーを開くと、その出版社のサイトが独自のプライバシーポリシーと慣行に従って情報を収集する場合があります。",
          "NutsNewsは、第三者の出版社サイト、広告ネットワーク、分析ツール、またはそれらのサイトに表示される埋め込みコンテンツのプライバシー慣行について責任を負いません。",
        ],
      },
      {
        id: "ai-summaries",
        title: "記事コンテンツとAI要約",
        body: [
          "NutsNewsは、RSSフィードや出版社ページの記事メタデータを使って、ポジティブなストーリーを見つけ、短い要約を作成します。",
          "NutsNewsは著作権で保護された記事全文を再掲載しません。サービスは、記事メタデータ、短い要約、ソース情報、サムネイル、カテゴリー、元の出版社ページへのリンクを保存して表示します。",
        ],
      },
      {
        id: "children",
        title: "子どものプライバシー",
        body: [
          "NutsNewsは一般向けのニュースリーダーです。アプリとサイトは、子どもから個人情報を故意に求めることはありません。",
          "子どもがNutsNewsに個人情報を提供したと思われる場合は、確認して対応できるようお問い合わせください。",
        ],
      },
      {
        id: "choices",
        title: "選択肢",
        body: [
          "NutsNewsはアカウントを作らずに使えます。いいねボタンをもう一度押していいねを外したり、設定でローカル設定を変更したり、アプリを削除して端末内のローカルデータを削除したりできます。",
          "このページのコントロールで、ウェブサイト分析をオフのままにするか、最小限の分析を許可できます。Do Not TrackとGlobal Privacy Controlは尊重され、ローカル設定で分析を許可していても分析をブロックします。",
          "元の出版社リンクを開くかどうかは選択できます。出版社のサイトはNutsNewsとは別であり、独自のプライバシー設定を持つ場合があります。",
        ],
      },
      {
        id: "changes",
        title: "このポリシーの変更",
        body: [
          "NutsNewsの変更に合わせて、このプライバシーポリシーが更新されることがあります。最新版は更新日とともにこのページに掲載されます。",
        ],
      },
      {
        id: "contact",
        title: "お問い合わせ",
        body: [
          "このプライバシーポリシーについての質問、プライバシーに関する依頼、またはNutsNewsへの一般的なフィードバックは、お問い合わせページをご利用ください。",
        ],
      },
    ],
    contactButton: "お問い合わせページを開く",
    contactAria:
      "プライバシーに関する質問またはフィードバックを送るため、NutsNewsのお問い合わせページを開く",
    returnTitle: "NutsNewsに戻る",
    returnBody:
      "NutsNewsのホームフィードで最新の前向きなストーリーを続けて読めます。",
    returnButton: "ホームに戻る",
    analyticsConsent: {
      title: "分析設定",
      body: "NutsNewsは、あなたが最小限の分析を許可した後にのみGoogle Analytics 4を読み込みます。この選択はこのブラウザだけに保存されます。",
      statusLabel: "現在の状態",
      statusAllowed: "最小限の分析が許可されています",
      statusDenied: "分析はオフです",
      statusBlocked: "ブラウザのプライバシー信号により分析がブロックされています",
      allowButton: "最小限の分析を許可",
      denyButton: "分析をオフのままにする",
    },
  },
};

function PolicySection({
  section,
  contactButton,
  contactAria,
}: {
  section: PolicySectionCopy;
  contactButton: string;
  contactAria: string;
}) {
  return (
    <section className="rounded-[1.75rem] border border-amber-300/15 bg-black/25 p-5 shadow-lg shadow-amber-950/10">
      <h2 className="text-lg font-black tracking-tight text-amber-100">
        {section.title}
      </h2>
      <div className="mt-3 space-y-3">
        {section.body.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-7 text-neutral-300">
            {paragraph}
          </p>
        ))}
      </div>

      {section.id === "contact" ? (
        <Link
          href="/contact"
          className="mt-5 inline-flex rounded-full border border-amber-300/25 bg-amber-400/15 px-5 py-3 text-sm font-black text-amber-100 transition hover:border-amber-200/60 hover:bg-amber-300 hover:text-neutral-950"
          aria-label={contactAria}
        >
          {contactButton}
        </Link>
      ) : null}
    </section>
  );
}

export function LocalizedPrivacyPolicyPage() {
  const selectedLanguage = useSelectedLanguage();
  const copy = privacyCopyByLanguage[selectedLanguage];

  return (
    <main
      lang={selectedLanguage}
      className="public-themed-page modern-home-shell min-h-screen overflow-hidden px-4 pb-36 pt-6 text-[var(--theme-text)]"
    >
      <section className="mx-auto w-full max-w-3xl">
        <section className="overflow-hidden rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/25 p-5 shadow-2xl shadow-amber-950/25 ring-1 ring-amber-300/5">
          <div className="rounded-[1.5rem] border border-amber-300/15 bg-gradient-to-br from-black/35 via-neutral-950/80 to-amber-950/25 p-5 shadow-inner shadow-amber-950/10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.9)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200">
                {copy.eyebrow}
              </span>
            </div>

            <h1 className="text-4xl font-black tracking-tight text-amber-50 sm:text-5xl">
              {copy.title}
            </h1>

            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300/80">
              {copy.lastUpdatedLabel}: {copy.lastUpdated}
            </p>

            <p className="mt-6 max-w-2xl text-base leading-8 text-neutral-300">
              {copy.intro}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/15">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300/80">
            {copy.highlightsEyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-amber-50">
            {copy.highlightsTitle}
          </h2>
          <div className="mt-5 grid gap-3">
            {copy.highlights.map((point) => (
              <div
                key={point}
                className="flex gap-3 rounded-3xl border border-amber-300/15 bg-black/25 p-4"
              >
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.8)]" />
                <p className="text-sm leading-6 text-neutral-300">{point}</p>
              </div>
            ))}
          </div>
        </section>

        <AnalyticsConsentControls copy={copy.analyticsConsent} />

        <div className="mt-6 grid gap-4">
          {copy.sections.map((section) => (
            <PolicySection
              key={section.id}
              section={section}
              contactButton={copy.contactButton}
              contactAria={copy.contactAria}
            />
          ))}
        </div>

        <section className="mt-6 rounded-[1.75rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/15">
          <h2 className="text-lg font-black tracking-tight text-amber-100">
            {copy.returnTitle}
          </h2>
          <p className="mt-3 text-sm leading-7 text-neutral-300">
            {copy.returnBody}
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-full border border-amber-300/25 bg-amber-400/15 px-5 py-3 text-sm font-black text-amber-100 transition hover:border-amber-200/60 hover:bg-amber-300 hover:text-neutral-950"
          >
            {copy.returnButton}
          </Link>
        </section>
      </section>

      <SiteFooter />
    </main>
  );
}
