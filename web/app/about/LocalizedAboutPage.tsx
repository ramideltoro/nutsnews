"use client";

import Link from "next/link";

import { type LanguageCode } from "@/lib/languages";
import { SiteFooter } from "../components/SiteFooter";
import { useSelectedLanguage } from "../components/useSelectedLanguage";

type CardCopy = {
  title: string;
  description: string;
};

type WorkflowCopy = CardCopy & {
  step: string;
  Icon: typeof DiscoverIcon;
};

type AboutCopy = {
  heroEyebrow: string;
  heroTitle: string;
  heroBody: string;
  readStories: string;
  contact: string;
  whyEyebrow: string;
  whyTitle: string;
  whyDescription: string;
  promises: CardCopy[];
  nameEyebrow: string;
  nameTitle: string;
  nameDescription: string;
  nameStory: string[];
  habitEyebrow: string;
  habitTitle: string;
  habitDescription: string;
  habitBody: string;
  builtEyebrow: string;
  builtTitle: string;
  builtDescription: string;
  builtFeatures: string[];
  workflowEyebrow: string;
  workflowTitle: string;
  workflowDescription: string;
  workflow: WorkflowCopy[];
  valuesEyebrow: string;
  valuesTitle: string;
  valuesDescription: string;
  principles: CardCopy[];
  biggerEyebrow: string;
  biggerTitle: string;
  biggerBody: string;
};

function DiscoverIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <circle cx="6" cy="18" r="1.5" />
      <path d="M5 11a8 8 0 0 1 8 8" />
      <path d="M5 5a14 14 0 0 1 14 14" />
    </svg>
  );
}

function FilterIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M4 5h16" />
      <path d="M7 11h10" />
      <path d="M10 17h4" />
    </svg>
  );
}

function SummaryIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5" />
      <path d="M10 12h6" />
      <path d="M10 16h4" />
    </svg>
  );
}

function ExternalStoryIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M14 4h6v6" />
      <path d="M10 14 20 4" />
      <path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" />
    </svg>
  );
}


const germanAboutCopy: AboutCopy = {
  heroEyebrow: "Über NutsNews",
  heroTitle: "Eine ruhigere Art, mit dem Guten in der Welt verbunden zu bleiben.",
  heroBody:
    "NutsNews gibt es, weil sich das Internet oft schwer anfühlt. Die Welt ist voller Freundlichkeit, Fortschritt, Kreativität, Mut, Entdeckungen und Menschen, die Bemerkenswertes tun. Diese Geschichten gehen leicht unter. NutsNews holt sie an einen einfachen Ort.",
  readStories: "Heutige Geschichten lesen",
  contact: "NutsNews kontaktieren",
  whyEyebrow: "Warum es das gibt",
  whyTitle: "Gute Nachrichten sollten leichter zu finden sein",
  whyDescription:
    "NutsNews ist für Leser gemacht, die mit der Welt verbunden bleiben möchten, ohne von ihr überwältigt zu werden. Das Ziel ist ein täglicher Feed, der optimistisch, nützlich und respektvoll mit deiner Aufmerksamkeit umgeht.",
  promises: [
    {
      title: "Positiv gestaltet",
      description:
        "NutsNews sucht Geschichten, die ermutigen: Erfolge in Gemeinschaften, inspirierende Menschen, hilfreiche Wissenschaft, Wohlbefinden, Tiere, Reisen, Kultur und kleine Fortschritte.",
    },
    {
      title: "Bewusst einfach",
      description:
        "Die Erfahrung dreht sich um einen klaren Feed, kurze Zusammenfassungen, nützliche Kategorien und einen deutlichen Weg zurück zum Originalverlag.",
    },
    {
      title: "Respektvoll mit Aufmerksamkeit",
      description:
        "Das Ziel ist nicht endloses Doomscrolling. Das Ziel ist, schnell etwas Gutes zu finden, sich etwas besser zu fühlen und den Tag weiterzugehen.",
    },
  ],
  nameEyebrow: "Der Name",
  nameTitle: "Warum es NutsNews heisst",
  nameDescription:
    "Der Name entstand aus derselben Suche, die das Produkt geprägt hat: etwas Positives, Einprägsames und passend für eine .com-Adresse zu finden.",
  nameStory: [
    "Die erste Idee war die offensichtlichste: GoodNews.com. Sie sagte genau, was die Seite sein sollte. Aber die Domain war bereits vergeben, genauso wie die einfachen Varianten rund um gute Nachrichten. Das Projekt brauchte einen Namen, der eigenständig, besonders und trotzdem klassisch wirkt.",
    "Bei dieser Suche führte der Weg von Domain-Checks zum Thesaurus. Beim Blick auf Synonyme für “good” fiel ein Wort sofort auf: “nuts”. Im Poker bedeutet the nuts die bestmögliche Hand. Diese Bedeutung machte den Namen nicht zu einem Kompromiss, sondern genau richtig.",
    "NutsNews wurde mehr als ein spielerischer Titel. Es wurde ein Versprechen: ein Ort für die beste Art von Nachrichten, Geschichten, die man behalten, teilen und wiederfinden möchte. Der Name ist kurz, merkbar, etwas überraschend und mit der Idee verbunden, die guten Dinge zu finden.",
  ],
  habitEyebrow: "Was es erreichen soll",
  habitTitle: "Den Newsfeed zu einer besseren Gewohnheit machen",
  habitDescription:
    "Das Projekt tut nicht so, als gäbe es keine schweren Dinge. Es schafft Platz für die andere Seite: Helfer, Macher, Durchbrüche, Erholungen, kleine Erfolge und die Erinnerung, dass Menschen überall Gutes tun.",
  habitBody:
    "Eine gute NutsNews-Geschichte sollte sich wie ein kleiner Reset anfühlen. Sie kann etwas lehren, eine interessante Person vorstellen, eine lösende Gemeinschaft zeigen oder einfach einen ruhigen Moment schenken. Der Feed ist bewusst fokussiert, gefiltert und leicht, damit positive Geschichten ohne lautes Internet-Suchen zugänglich werden.",
  builtEyebrow: "Was gebaut wurde",
  builtTitle: "Eine vollständige Plattform für positive Nachrichten, nicht nur eine Seite",
  builtDescription:
    "NutsNews ist zu einem funktionierenden Produkt gewachsen: öffentliche Website, automatisierte Artikel-Pipeline, Admin-Werkzeuge, Monitoring, mobile Erfahrung und Grundlage für eine native iOS-App.",
  builtFeatures: [
    "Eine mobile-first NutsNews-Website mit ruhiger Amber-Identität",
    "RSS-Ingestion von Publishern, die automatisch neue Kandidaten entdeckt",
    "KI-unterstützte Filterung für aufbauende, stressarme Geschichten",
    "Kurze, originale Zusammenfassungen, die beim Auswählen helfen",
    "Artikelkategorien zum Stöbern nach Stimmung und Thema",
    "Story-Karten mit Bild, Quelle und Datum",
    "Endloses Scrollen für einen leichten täglichen Feed",
    "Kontakt- und Datenschutzseiten für eine vollständigere öffentliche Seite",
    "Admin-Dashboards für Betrieb, KI-Nutzung, Feeds und Systemzustand",
    "Cloudflare-, Vercel- und Supabase-Infrastruktur für Geschwindigkeit, Skalierung und niedrige Kosten",
    "Better Stack und Sentry, damit Probleme leichter erkannt und behoben werden",
    "Eine native iOS-App rund um dieselbe positive Nachrichtenerfahrung",
  ],
  workflowEyebrow: "So funktioniert es",
  workflowTitle: "Eine sorgfältige Pipeline hinter einem einfachen Feed",
  workflowDescription:
    "Leser sehen eine ruhige Liste von Geschichten. Dahinter entdeckt ein System Artikel, filtert sie nach Ton und Passung, erstellt hilfreiche Zusammenfassungen und hält die Website mit praktischer Cloud-Infrastruktur am Laufen.",
  workflow: [
    {
      step: "Entdecken",
      title: "Frische Geschichten kommen aus Publisher-Feeds",
      description:
        "NutsNews beginnt mit RSS-Quellen echter Publisher und prüft laufend neue Artikel, die zur Stimmung der Seite passen könnten.",
      Icon: DiscoverIcon,
    },
    {
      step: "Filtern",
      title: "KI hilft, die Stimmung des Feeds zu schützen",
      description:
        "Die Kurationsschicht lehnt stressige Themen ab und bevorzugt Geschichten, die konstruktiv, menschlich, nützlich, hoffnungsvoll oder einfach erfreulich sind.",
      Icon: FilterIcon,
    },
    {
      step: "Zusammenfassen",
      title: "Leser bekommen zuerst die ruhige Version",
      description:
        "Angenommene Artikel erscheinen mit kurzen Zusammenfassungen, Metadaten und Kategorien, damit der Feed schnell, lesbar und leicht zu erkunden bleibt.",
      Icon: SummaryIcon,
    },
    {
      step: "Weiterleiten",
      title: "Die Originalverlage bleiben das Ziel",
      description:
        "NutsNews ersetzt den Artikel nicht. Jede Geschichte führt zur Originalquelle zurück, damit Leser beim Publisher weiterlesen können, der sie veröffentlicht hat.",
      Icon: ExternalStoryIcon,
    },
  ],
  valuesEyebrow: "Mit Absicht gebaut",
  valuesTitle: "Die Produktwerte",
  valuesDescription:
    "Jede technische Entscheidung unterstützt dieselbe Leserfahrung: schneller Zugang zu Geschichten, die gut tun, weniger Ablenkung und eine Website, die wachsen kann, ohne kompliziert zu werden.",
  principles: [
    {
      title: "Ruhige Technologie",
      description:
        "Die Technik hinter NutsNews soll in den Hintergrund treten. Workers, Caching, Monitoring und Dashboards dienen einem einfachen Versprechen: Die Seite soll schnell, stabil und friedlich wirken.",
    },
    {
      title: "Menschliche Kuration",
      description:
        "KI hilft, ersetzt aber keinen Geschmack. Das Produkt folgt einer klaren redaktionellen Richtung: weniger stressige Überschriften, mehr Geschichten, die ein Lächeln wert sind.",
    },
    {
      title: "Schlank und resilient",
      description:
        "Die Plattform nutzt praktische Werkzeuge, die schrittweise wachsen können: Next.js für die Website, Cloudflare Workers für Automatisierung, Supabase für Speicherung, Vercel für Deployment und Observability für Zuverlässigkeit.",
    },
    {
      title: "Platz zum Wachsen",
      description:
        "NutsNews entwickelt sich weiter. Die Grundlage unterstützt mehr Feeds, reichere Kategorien, bessere Dashboards, smartere Qualitätskontrollen und eine glattere Web- und Mobile-Erfahrung.",
    },
  ],
  biggerEyebrow: "Die grössere Idee",
  biggerTitle:
    "NutsNews erinnert daran, dass positive Geschichten ebenfalls grossartiges Produktdesign verdienen.",
  biggerBody:
    "Die beste Version von NutsNews ist warm, nützlich, vertrauenswürdig und leicht wiederzufinden. Sie sollte sich anfühlen wie ein geöffnetes Fenster statt wie ein Sturm. Genau diese Geschichte will das Projekt erzählen: Technologie kann Medien sanfter, fokussierter und menschlicher machen.",
};

const greekAboutCopy: AboutCopy = {
  heroEyebrow: "Σχετικά με το NutsNews",
  heroTitle: "Ένας πιο ήρεμος τρόπος να παρακολουθείτε τα καλά που συμβαίνουν στον κόσμο.",
  heroBody:
    "Το NutsNews υπάρχει επειδή το διαδίκτυο μπορεί να μοιάζει βαρύ. Ο κόσμος είναι γεμάτος καλοσύνη, πρόοδο, δημιουργικότητα, θάρρος, ανακαλύψεις και καθημερινούς ανθρώπους που κάνουν αξιοσημείωτα πράγματα, όμως αυτές οι ιστορίες χάνονται εύκολα. Το NutsNews τις φέρνει μπροστά σε ένα απλό μέρος.",
  readStories: "Διαβάστε τις σημερινές ιστορίες",
  contact: "Επικοινωνία με το NutsNews",
  whyEyebrow: "Γιατί υπάρχει",
  whyTitle: "Οι καλές ειδήσεις πρέπει να βρίσκονται πιο εύκολα",
  whyDescription:
    "Το NutsNews είναι φτιαγμένο για αναγνώστες που θέλουν να μένουν συνδεδεμένοι με τον κόσμο χωρίς να κατακλύζονται από αυτόν. Η αποστολή είναι μια καθημερινή ροή που νιώθει αισιόδοξη, χρήσιμη και σέβεται την προσοχή σας.",
  promises: [
    {
      title: "Θετικό από τον σχεδιασμό",
      description:
        "Το NutsNews αναζητά ιστορίες που ενθαρρύνουν: επιτυχίες κοινοτήτων, εμπνευσμένους ανθρώπους, χρήσιμη επιστήμη, ευεξία, ζώα, ταξίδια, πολιτισμό και μικρές στιγμές προόδου.",
    },
    {
      title: "Απλό με πρόθεση",
      description:
        "Η εμπειρία βασίζεται σε μια καθαρή ροή, σύντομες περιλήψεις, χρήσιμες κατηγορίες και σαφή επιστροφή στον αρχικό εκδότη.",
    },
    {
      title: "Σέβεται την προσοχή",
      description:
        "Ο στόχος δεν είναι να κρατά τους αναγνώστες σε ατελείωτο doomscrolling. Ο στόχος είναι να βρίσκετε κάτι καλό, να νιώθετε λίγο καλύτερα και να συνεχίζετε τη μέρα σας.",
    },
  ],
  nameEyebrow: "Το όνομα",
  nameTitle: "Γιατί ονομάζεται NutsNews",
  nameDescription:
    "Το όνομα ήρθε από την ίδια αναζήτηση που διαμόρφωσε το προϊόν: μια αναζήτηση για κάτι θετικό, αξέχαστο και άξιο για μια .com διεύθυνση.",
  nameStory: [
    "Η πρώτη ιδέα ήταν η πιο προφανής: GoodNews.com. Έλεγε ακριβώς τι ήθελε να είναι ο ιστότοπος. Όμως το domain ήταν ήδη πιασμένο, όπως και οι καθαρές παραλλαγές γύρω από τις καλές ειδήσεις. Το project χρειαζόταν ένα όνομα που να στέκεται μόνο του.",
    "Στην πορεία, η αναζήτηση πέρασε από τα domain checkers στον θησαυρό λέξεων. Κοιτώντας συνώνυμα του “good”, μια λέξη ξεχώρισε: “nuts”. Στο πόκερ, the nuts σημαίνει το καλύτερο δυνατό φύλλο. Αυτή η έννοια έκανε το όνομα να μοιάζει όχι με συμβιβασμό, αλλά με τέλεια επιλογή.",
    "Το NutsNews έγινε κάτι περισσότερο από ένας παιχνιδιάρικος τίτλος. Έγινε δήλωση πρόθεσης: ένας χώρος για το καλύτερο είδος ειδήσεων, ιστορίες που αξίζει να κρατήσετε, να μοιραστείτε και να ξαναβρείτε.",
  ],
  habitEyebrow: "Τι προσπαθεί να κάνει",
  habitTitle: "Να μετατρέψει τη ροή ειδήσεων σε καλύτερη συνήθεια",
  habitDescription:
    "Το project δεν προσποιείται ότι τα δύσκολα πράγματα δεν υπάρχουν. Προσπαθεί να κάνει χώρο και για την άλλη πλευρά: τους βοηθούς, τους δημιουργούς, τις ανακαλύψεις, τις ανακάμψεις, τις μικρές νίκες και τις υπενθυμίσεις ότι οι άνθρωποι συνεχίζουν να κάνουν καλό έργο παντού.",
  habitBody:
    "Μια καλή ιστορία του NutsNews πρέπει να μοιάζει με μικρή επαναφορά. Μπορεί να σας μάθει κάτι, να σας γνωρίσει έναν άνθρωπο που αξίζει, να δείξει μια κοινότητα που λύνει πρόβλημα ή απλώς να προσφέρει ανακούφιση. Η ροή είναι εστιασμένη, φιλτραρισμένη και ελαφριά.",
  builtEyebrow: "Τι έχει χτιστεί",
  builtTitle: "Μια πλήρης πλατφόρμα θετικών ειδήσεων, όχι απλώς μια σελίδα",
  builtDescription:
    "Το NutsNews έχει εξελιχθεί σε λειτουργικό προϊόν με δημόσιο ιστότοπο, αυτοματοποιημένη ροή άρθρων, εργαλεία διαχείρισης, παρακολούθηση, mobile εμπειρία και βάση για native iOS εφαρμογή.",
  builtFeatures: [
    "Mobile-first ιστότοπος NutsNews με ήρεμη amber οπτική ταυτότητα",
    "RSS ingestion από εκδότες που ανακαλύπτει αυτόματα νέες υποψήφιες ιστορίες",
    "Φιλτράρισμα με βοήθεια AI για θετικές, χαμηλού στρες ιστορίες",
    "Σύντομες, πρωτότυπες περιλήψεις που βοηθούν τους αναγνώστες να επιλέξουν",
    "Κατηγορίες άρθρων για περιήγηση ανά διάθεση και θέμα",
    "Κάρτες ιστοριών με εικόνα, πηγή και ημερομηνία",
    "Ατελείωτη κύλιση για ελαφριά καθημερινή εμπειρία",
    "Σελίδες επικοινωνίας και απορρήτου για πιο ολοκληρωμένο δημόσιο site",
    "Admin dashboards για λειτουργίες, χρήση AI, feeds και υγεία συστήματος",
    "Cloudflare, Vercel και Supabase για ταχύτητα, κλιμάκωση και χαμηλό κόστος",
    "Better Stack και Sentry ώστε τα προβλήματα να εντοπίζονται και να διορθώνονται ευκολότερα",
    "Native iOS εφαρμογή γύρω από την ίδια εμπειρία θετικών ειδήσεων",
  ],
  workflowEyebrow: "Πώς λειτουργεί",
  workflowTitle: "Μια προσεκτική pipeline πίσω από μια απλή ροή",
  workflowDescription:
    "Οι αναγνώστες βλέπουν μια ήσυχη λίστα ιστοριών. Πίσω της, ένα σύστημα ανακαλύπτει άρθρα, τα φιλτράρει για τόνο και καταλληλότητα, δημιουργεί χρήσιμες περιλήψεις και κρατά τον ιστότοπο λειτουργικό με πρακτική cloud υποδομή.",
  workflow: [
    {
      step: "Ανακάλυψη",
      title: "Οι φρέσκες ιστορίες έρχονται από feeds εκδοτών",
      description:
        "Το NutsNews ξεκινά με RSS πηγές από πραγματικούς εκδότες και ελέγχει συνεχώς νέα άρθρα που μπορεί να ταιριάζουν στον τόνο του site.",
      Icon: DiscoverIcon,
    },
    {
      step: "Φίλτρο",
      title: "Το AI βοηθά να προστατευτεί η διάθεση της ροής",
      description:
        "Το επίπεδο επιμέλειας απορρίπτει αγχωτικά θέματα και προτιμά ιστορίες που είναι εποικοδομητικές, ανθρώπινες, χρήσιμες, ελπιδοφόρες ή απλώς ευχάριστες.",
      Icon: FilterIcon,
    },
    {
      step: "Περίληψη",
      title: "Οι αναγνώστες παίρνουν πρώτα την ήρεμη εκδοχή",
      description:
        "Τα αποδεκτά άρθρα παρουσιάζονται με σύντομες περιλήψεις, μεταδεδομένα και κατηγορίες, ώστε η ροή να μένει γρήγορη, ευανάγνωστη και εύκολη στην εξερεύνηση.",
      Icon: SummaryIcon,
    },
    {
      step: "Συνέχεια",
      title: "Οι αρχικοί εκδότες παραμένουν ο προορισμός",
      description:
        "Το NutsNews δεν προσπαθεί να αντικαταστήσει το άρθρο. Κάθε ιστορία οδηγεί πίσω στην αρχική πηγή, ώστε οι αναγνώστες να συνεχίζουν στον εκδότη που την ανέφερε.",
      Icon: ExternalStoryIcon,
    },
  ],
  valuesEyebrow: "Χτισμένο με πρόθεση",
  valuesTitle: "Οι αξίες του προϊόντος",
  valuesDescription:
    "Κάθε τεχνική απόφαση στηρίζει την ίδια εμπειρία: γρηγορότερη πρόσβαση σε ιστορίες που κάνουν καλό, λιγότερους περισπασμούς και ένα site που μπορεί να μεγαλώσει χωρίς να γίνει περίπλοκο.",
  principles: [
    {
      title: "Ήρεμη τεχνολογία",
      description:
        "Η μηχανική πίσω από το NutsNews πρέπει να χάνεται στο παρασκήνιο. Workers, cache, monitoring και dashboards υπηρετούν μια απλή υπόσχεση: ο ιστότοπος να νιώθει γρήγορος, σταθερός και ήρεμος.",
    },
    {
      title: "Ανθρώπινη επιμέλεια",
      description:
        "Το AI χρησιμοποιείται ως βοηθός, όχι ως αντικατάσταση γούστου. Το προϊόν έχει καθαρή εκδοτική κατεύθυνση: λιγότερο στρες, περισσότερες ιστορίες που αξίζουν ένα χαμόγελο.",
    },
    {
      title: "Ελαφρύ και ανθεκτικό",
      description:
        "Η πλατφόρμα χτίστηκε με πρακτικά εργαλεία που μπορούν να κλιμακωθούν σταδιακά: Next.js, Cloudflare Workers, Supabase, Vercel και observability.",
    },
    {
      title: "Χώρος για ανάπτυξη",
      description:
        "Το NutsNews συνεχίζει να εξελίσσεται. Η βάση υποστηρίζει περισσότερα feeds, πλουσιότερες κατηγορίες, καλύτερα dashboards, εξυπνότερους ελέγχους ποιότητας και ομαλότερη εμπειρία σε web και mobile.",
    },
  ],
  biggerEyebrow: "Η μεγαλύτερη ιδέα",
  biggerTitle:
    "Το NutsNews υπενθυμίζει ότι και οι θετικές ιστορίες αξίζουν εξαιρετικό product design.",
  biggerBody:
    "Η καλύτερη εκδοχή του NutsNews είναι ζεστή, χρήσιμη, αξιόπιστη και εύκολη να επιστρέψεις σε αυτήν. Πρέπει να μοιάζει με άνοιγμα παραθύρου, όχι με είσοδο σε καταιγίδα. Αυτή είναι η ιστορία που προσπαθεί να πει το project: η τεχνολογία μπορεί να κάνει τα media πιο ήπια, πιο εστιασμένα και πιο ανθρώπινα.",
};

const aboutCopyByLanguage: Record<LanguageCode, AboutCopy> = {
  "de-CH": germanAboutCopy,
  de: germanAboutCopy,
  el: greekAboutCopy,
  en: {
    heroEyebrow: "About NutsNews",
    heroTitle: "A calmer way to keep up with the good happening in the world.",
    heroBody:
      "NutsNews exists because the internet can feel heavy. The world is full of kindness, progress, creativity, courage, discovery, and everyday people doing remarkable things, but those stories are easy to miss. NutsNews brings them forward in one simple place.",
    readStories: "Read today's stories",
    contact: "Contact NutsNews",
    whyEyebrow: "Why it exists",
    whyTitle: "Good news should be easier to find",
    whyDescription:
      "NutsNews is built for readers who want to stay connected to the world without being overwhelmed by it. The mission is to create a daily feed that feels optimistic, useful, and respectful of your attention.",
    promises: [
      {
        title: "Positive by design",
        description:
          "NutsNews looks for stories that leave readers feeling encouraged: community wins, inspiring people, helpful science, wellness, animals, travel, culture, and small moments of progress.",
      },
      {
        title: "Simple on purpose",
        description:
          "The experience is built around a clean scrolling feed, short summaries, useful categories, and a clear path back to the original publisher.",
      },
      {
        title: "Respectful of attention",
        description:
          "The goal is not to keep readers doom-scrolling. The goal is to make it easy to find something good, feel a little better, and move on with your day.",
      },
    ],
    nameEyebrow: "The name",
    nameTitle: "Why it is called NutsNews",
    nameDescription:
      "The name came from the same search that shaped the product: a search for something positive, memorable, and worthy of a .com home.",
    nameStory: [
      "The first idea was the most obvious one: GoodNews.com. It said exactly what the site was meant to be. But that domain was already taken, and so were the clean, simple variations around good news. The project needed a name that could stand on its own, feel distinctive, and still live at a classic .com address.",
      "During that search, the name wandered from domain checkers to the thesaurus. While looking through synonyms for “good,” one word made itself impossible to ignore: “nuts.” In poker, the nuts means the best possible hand. That meaning changed the whole name from a compromise into simply perfect.",
      "NutsNews became more than a playful title. It became a statement of intent: this is a place for the best kind of news, the stories that feel worth keeping, sharing, and returning to. The name is short, memorable, a little unexpected, and quietly connected to the idea at the center of the site, finding the good stuff.",
    ],
    habitEyebrow: "What it is trying to do",
    habitTitle: "Turn the news feed into a better habit",
    habitDescription:
      "The project is not trying to pretend hard things do not exist. It is trying to make room for the other side of the story too: the helpers, the builders, the breakthroughs, the recoveries, the tiny wins, and the reminders that people are still doing good work everywhere.",
    habitBody:
      "A great NutsNews story should feel like a small reset. It may teach you something, introduce you to a person worth knowing about, highlight a community solving a problem, or simply give you a moment of relief. The feed is intentionally focused, filtered, and lightweight so readers can enjoy positive stories without digging through a noisy internet first.",
    builtEyebrow: "What has been built",
    builtTitle: "A full positive news platform, not just a page",
    builtDescription:
      "NutsNews has grown into a working product with a public website, automated article pipeline, admin tools, monitoring, mobile experience, and a native iOS app foundation.",
    builtFeatures: [
      "A mobile first NutsNews website with a calm amber visual identity",
      "Publisher RSS ingestion that discovers fresh story candidates automatically",
      "AI assisted filtering for uplifting, non-stressful stories",
      "Short, original summaries that help readers decide what to open",
      "Article categories for browsing by mood and theme",
      "Thumbnail first story cards with source and date context",
      "Infinite scrolling for a lightweight daily feed experience",
      "Contact and privacy pages for a more complete public site",
      "Admin dashboards for reviewing operations, AI usage, feeds, and system health",
      "Cloudflare, Vercel, and Supabase infrastructure for speed, scale, and low operating cost",
      "Better Stack and Sentry observability so issues are easier to detect and fix",
      "A native iOS companion app built around the same positive news experience",
    ],
    workflowEyebrow: "How it works",
    workflowTitle: "A careful pipeline behind a simple feed",
    workflowDescription:
      "Readers see a quiet list of stories. Behind that list is a system that discovers articles, filters them for tone and fit, prepares useful summaries, and keeps the site running with practical cloud infrastructure.",
    workflow: [
      {
        step: "Discover",
        title: "Fresh stories come from publisher feeds",
        description:
          "NutsNews starts with RSS sources from real publishers, then continuously checks for new articles that may fit the tone of the site.",
        Icon: DiscoverIcon,
      },
      {
        step: "Filter",
        title: "AI helps protect the mood of the feed",
        description:
          "The curation layer rejects stressful topics and favors stories that are constructive, human, useful, hopeful, or simply delightful.",
        Icon: FilterIcon,
      },
      {
        step: "Summarize",
        title: "Readers get the calm version first",
        description:
          "Accepted articles are presented with short summaries, metadata, and categories so the feed stays quick, readable, and easy to explore.",
        Icon: SummaryIcon,
      },
      {
        step: "Send readers onward",
        title: "Original publishers remain the destination",
        description:
          "NutsNews does not try to replace the article. Every story points back to the original source so readers can continue with the publisher who reported it.",
        Icon: ExternalStoryIcon,
      },
    ],
    valuesEyebrow: "Built with intention",
    valuesTitle: "The product values",
    valuesDescription:
      "Every technical decision supports the same reader experience: faster access to better feeling stories, fewer distractions, and a site that can grow without becoming complicated to use.",
    principles: [
      {
        title: "Calm technology",
        description:
          "The engineering behind NutsNews is meant to disappear into the background. Workers, caching, monitoring, and dashboards all support a simple reader promise: the site should feel fast, steady, and peaceful.",
      },
      {
        title: "Human centered curation",
        description:
          "AI is used as a helper, not as a replacement for taste. The product is shaped around a clear editorial direction: fewer stressful headlines, more stories worth smiling about.",
      },
      {
        title: "Lean and resilient",
        description:
          "The platform was built with practical tools that can scale gradually: Next.js for the website, Cloudflare Workers for automation, Supabase for storage, Vercel for deployment, and observability for reliability.",
      },
      {
        title: "Room to grow",
        description:
          "NutsNews is still evolving. The foundation supports more feeds, richer categories, better dashboards, smarter quality controls, and a smoother experience across web and mobile.",
      },
    ],
    biggerEyebrow: "The bigger idea",
    biggerTitle:
      "NutsNews is a reminder that positive stories deserve great product design too.",
    biggerBody:
      "The best version of NutsNews is warm, useful, trustworthy, and easy to return to. It should feel like opening a window instead of entering a storm. That is the story this project is trying to tell: technology can help make media gentler, more focused, and more human.",
  },
  fr: {
    heroEyebrow: "À propos de NutsNews",
    heroTitle:
      "Une façon plus calme de suivre ce qu’il y a de bon dans le monde.",
    heroBody:
      "NutsNews existe parce qu’Internet peut parfois sembler lourd. Le monde est rempli de gentillesse, de progrès, de créativité, de courage, de découvertes et de personnes ordinaires qui font des choses remarquables, mais ces histoires sont faciles à manquer. NutsNews les met en avant dans un endroit simple.",
    readStories: "Lire les histoires du jour",
    contact: "Contacter NutsNews",
    whyEyebrow: "Pourquoi cela existe",
    whyTitle: "Les bonnes nouvelles devraient être plus faciles à trouver",
    whyDescription:
      "NutsNews est conçu pour les lecteurs qui veulent rester connectés au monde sans être submergés. La mission est de créer un fil quotidien optimiste, utile et respectueux de votre attention.",
    promises: [
      {
        title: "Positif par conception",
        description:
          "NutsNews cherche des histoires qui encouragent les lecteurs : réussites de communautés, personnes inspirantes, science utile, bien-être, animaux, voyages, culture et petits moments de progrès.",
      },
      {
        title: "Simple volontairement",
        description:
          "L’expérience repose sur un fil clair, de courts résumés, des catégories utiles et un accès évident vers le média d’origine.",
      },
      {
        title: "Respectueux de l’attention",
        description:
          "Le but n’est pas de garder les lecteurs dans un défilement sans fin. Le but est de trouver facilement quelque chose de bon, de se sentir un peu mieux, puis de continuer sa journée.",
      },
    ],
    nameEyebrow: "Le nom",
    nameTitle: "Pourquoi cela s’appelle NutsNews",
    nameDescription:
      "Le nom vient de la même recherche qui a façonné le produit : trouver quelque chose de positif, mémorable et digne d’un domaine .com.",
    nameStory: [
      "La première idée était la plus évidente : GoodNews.com. Elle disait exactement ce que le site devait être. Mais ce domaine était déjà pris, tout comme les variations simples autour de good news. Le projet avait besoin d’un nom capable d’exister par lui-même, distinctif, et toujours installé sur une adresse .com classique.",
      "Pendant cette recherche, le nom est passé des vérificateurs de domaines au thésaurus. En regardant les synonymes de « good », un mot est devenu impossible à ignorer : « nuts ». Au poker, the nuts signifie la meilleure main possible. Ce sens a transformé le nom d’un compromis en quelque chose de simplement parfait.",
      "NutsNews est devenu plus qu’un titre amusant. C’est devenu une intention : un endroit pour le meilleur type d’actualités, les histoires qui méritent d’être gardées, partagées et retrouvées. Le nom est court, mémorable, un peu inattendu, et discrètement lié à l’idée centrale du site : trouver ce qu’il y a de bon.",
    ],
    habitEyebrow: "Ce que le site essaie de faire",
    habitTitle: "Transformer le fil d’actualités en meilleure habitude",
    habitDescription:
      "Le projet ne prétend pas que les choses difficiles n’existent pas. Il laisse aussi de la place à l’autre côté de l’histoire : les personnes qui aident, celles qui construisent, les percées, les reprises, les petites victoires et les rappels que des gens font encore du bon travail partout.",
    habitBody:
      "Une grande histoire NutsNews doit ressembler à une petite respiration. Elle peut vous apprendre quelque chose, vous présenter une personne à connaître, mettre en avant une communauté qui résout un problème, ou simplement vous offrir un moment de soulagement. Le fil est volontairement ciblé, filtré et léger pour profiter d’histoires positives sans fouiller d’abord dans un Internet bruyant.",
    builtEyebrow: "Ce qui a été construit",
    builtTitle:
      "Une plateforme complète de nouvelles positives, pas seulement une page",
    builtDescription:
      "NutsNews est devenu un produit réel avec un site public, un pipeline automatique d’articles, des outils d’administration, de la surveillance, une expérience mobile et les bases d’une application iOS native.",
    builtFeatures: [
      "Un site NutsNews pensé mobile d’abord avec une identité visuelle ambrée et calme",
      "Une ingestion RSS de médias qui découvre automatiquement de nouvelles histoires candidates",
      "Un filtrage assisté par IA pour des histoires positives et peu stressantes",
      "Des résumés courts et originaux pour aider les lecteurs à choisir quoi ouvrir",
      "Des catégories d’articles pour parcourir par ambiance et thème",
      "Des cartes avec image, source et date en contexte",
      "Un défilement infini pour un fil quotidien léger",
      "Des pages contact et confidentialité pour un site public plus complet",
      "Des tableaux de bord admin pour suivre les opérations, l’usage IA, les flux et la santé du système",
      "Une infrastructure Cloudflare, Vercel et Supabase pour la vitesse, l’échelle et un faible coût",
      "Better Stack et Sentry pour détecter et corriger les problèmes plus facilement",
      "Une application iOS native construite autour de la même expérience de nouvelles positives",
    ],
    workflowEyebrow: "Comment ça fonctionne",
    workflowTitle: "Un pipeline soigneux derrière un fil simple",
    workflowDescription:
      "Les lecteurs voient une liste calme d’histoires. Derrière cette liste, un système découvre des articles, les filtre selon le ton et la pertinence, prépare des résumés utiles et maintient le site avec une infrastructure cloud pratique.",
    workflow: [
      {
        step: "Découvrir",
        title: "Les nouvelles histoires viennent des flux des médias",
        description:
          "NutsNews commence avec des sources RSS de vrais éditeurs, puis vérifie en continu les nouveaux articles qui pourraient correspondre au ton du site.",
        Icon: DiscoverIcon,
      },
      {
        step: "Filtrer",
        title: "L’IA aide à protéger l’ambiance du fil",
        description:
          "La couche de curation rejette les sujets stressants et favorise les histoires constructives, humaines, utiles, pleines d’espoir ou simplement délicieuses.",
        Icon: FilterIcon,
      },
      {
        step: "Résumer",
        title: "Les lecteurs voient d’abord la version calme",
        description:
          "Les articles acceptés sont présentés avec de courts résumés, des métadonnées et des catégories pour garder le fil rapide, lisible et facile à explorer.",
        Icon: SummaryIcon,
      },
      {
        step: "Rediriger",
        title: "Les éditeurs d’origine restent la destination",
        description:
          "NutsNews ne cherche pas à remplacer l’article. Chaque histoire renvoie vers la source originale afin que les lecteurs puissent continuer avec le média qui l’a publiée.",
        Icon: ExternalStoryIcon,
      },
    ],
    valuesEyebrow: "Construit avec intention",
    valuesTitle: "Les valeurs du produit",
    valuesDescription:
      "Chaque décision technique soutient la même expérience lecteur : accéder plus vite à des histoires qui font du bien, avec moins de distractions, et un site capable de grandir sans devenir compliqué.",
    principles: [
      {
        title: "Technologie calme",
        description:
          "L’ingénierie derrière NutsNews doit disparaître en arrière-plan. Workers, cache, surveillance et tableaux de bord servent une promesse simple : le site doit être rapide, stable et paisible.",
      },
      {
        title: "Curation centrée sur l’humain",
        description:
          "L’IA sert d’aide, pas de remplacement du goût. Le produit suit une direction éditoriale claire : moins de titres stressants, plus d’histoires qui donnent envie de sourire.",
      },
      {
        title: "Léger et résilient",
        description:
          "La plateforme a été construite avec des outils pratiques capables d’évoluer progressivement : Next.js pour le site, Cloudflare Workers pour l’automatisation, Supabase pour le stockage, Vercel pour le déploiement et l’observabilité pour la fiabilité.",
      },
      {
        title: "De la place pour grandir",
        description:
          "NutsNews continue d’évoluer. La base permet plus de flux, des catégories plus riches, de meilleurs tableaux de bord, des contrôles qualité plus intelligents et une expérience plus fluide sur le web et mobile.",
      },
    ],
    biggerEyebrow: "L’idée plus grande",
    biggerTitle:
      "NutsNews rappelle que les histoires positives méritent aussi un excellent design produit.",
    biggerBody:
      "La meilleure version de NutsNews est chaleureuse, utile, fiable et facile à retrouver. Elle devrait donner l’impression d’ouvrir une fenêtre plutôt que d’entrer dans une tempête. C’est l’histoire que ce projet essaie de raconter : la technologie peut rendre les médias plus doux, plus concentrés et plus humains.",
  },
  ja: {
    heroEyebrow: "NutsNewsについて",
    heroTitle: "世界で起きているよいことを、もっと穏やかに追いかける場所。",
    heroBody:
      "NutsNewsは、インターネットが重たく感じられることがあるから生まれました。世界にはやさしさ、前進、創造力、勇気、発見、そして素晴らしいことをしている普通の人たちがあふれています。でも、そうした物語は見逃されがちです。NutsNewsはそれをひとつのシンプルな場所に集めます。",
    readStories: "今日のストーリーを読む",
    contact: "NutsNewsに連絡する",
    whyEyebrow: "存在する理由",
    whyTitle: "よいニュースはもっと見つけやすくあるべき",
    whyDescription:
      "NutsNewsは、世界とつながっていたいけれど圧倒されたくない読者のために作られています。楽観的で、役に立ち、あなたの時間を大切にする毎日のフィードを目指しています。",
    promises: [
      {
        title: "ポジティブを前提に設計",
        description:
          "NutsNewsは、地域の成功、刺激をくれる人々、役立つ科学、ウェルネス、動物、旅、文化、小さな前進など、読者を励ましてくれる物語を探します。",
      },
      {
        title: "意図してシンプルに",
        description:
          "きれいに読めるフィード、短い要約、使いやすいカテゴリー、元の出版社へ戻る明確な導線を中心に体験を作っています。",
      },
      {
        title: "注意を大切にする",
        description:
          "読者を延々とスクロールさせることが目的ではありません。よいものを簡単に見つけ、少し気分を上げて、そのまま一日へ戻れることが目的です。",
      },
    ],
    nameEyebrow: "名前",
    nameTitle: "なぜNutsNewsという名前なのか",
    nameDescription:
      "この名前は、プロダクトを形づくった同じ探求から生まれました。前向きで、覚えやすく、.comにふさわしい名前を探す旅です。",
    nameStory: [
      "最初の案はとてもわかりやすいものでした。GoodNews.comです。サイトが目指すものをそのまま表していました。でも、そのドメインはすでに使われていて、good newsに近いシンプルな候補も取られていました。プロジェクトには、独自に立ち、印象に残り、それでもクラシックな.comで使える名前が必要でした。",
      "その探索の途中で、名前探しはドメイン検索から類語辞典へ移りました。「good」の類語を見ていたとき、ひとつの言葉がどうしても目に留まりました。“nuts”です。ポーカーでは、the nutsは最高の手を意味します。その意味が、妥協に見えた名前を、ただ完璧なものへ変えました。",
      "NutsNewsは、ただ遊び心のあるタイトル以上のものになりました。最高の種類のニュース、残しておきたくなり、共有したくなり、また戻ってきたくなる物語のための場所だという意思表示になりました。短く、覚えやすく、少し意外で、サイトの中心にある「よいものを見つける」という考えにつながっています。",
    ],
    habitEyebrow: "目指していること",
    habitTitle: "ニュースフィードをよりよい習慣に変える",
    habitDescription:
      "このプロジェクトは、難しい出来事が存在しないふりをするものではありません。助ける人、作る人、突破口、回復、小さな勝利、そして世界のあちこちで人々がよい仕事をしていることも見えるようにしたいのです。",
    habitBody:
      "よいNutsNewsの物語は、小さなリセットのように感じられるべきです。何かを学べたり、知る価値のある人に出会えたり、課題を解決するコミュニティを知れたり、ただほっとできたりします。フィードは意図的に絞られ、フィルターされ、軽く作られているので、騒がしいインターネットを掘り進めなくてもポジティブな物語を楽しめます。",
    builtEyebrow: "作られているもの",
    builtTitle: "ただのページではなく、ポジティブニュースのプラットフォーム",
    builtDescription:
      "NutsNewsは、公開サイト、自動記事パイプライン、管理ツール、監視、モバイル体験、そしてネイティブiOSアプリの基盤を持つ実際のプロダクトへ成長しています。",
    builtFeatures: [
      "穏やかなアンバーのビジュアルを持つモバイルファーストのNutsNewsサイト",
      "新しい候補記事を自動で見つける出版社RSSの取り込み",
      "前向きでストレスの少ない記事を選ぶAI支援フィルタリング",
      "読む記事を選びやすくする短く独自の要約",
      "気分やテーマで探せる記事カテゴリー",
      "サムネイル、ソース、日付を備えたストーリーカード",
      "軽い毎日のフィード体験のための無限スクロール",
      "公開サイトとして整えるための問い合わせページとプライバシーページ",
      "運用、AI使用量、フィード、システム状態を確認する管理ダッシュボード",
      "速度、拡張性、低コストを支えるCloudflare、Vercel、Supabaseの基盤",
      "問題を見つけて直しやすくするBetter StackとSentryの監視",
      "同じポジティブニュース体験を中心にしたネイティブiOS companion app",
    ],
    workflowEyebrow: "仕組み",
    workflowTitle: "シンプルなフィードの裏にある丁寧なパイプライン",
    workflowDescription:
      "読者には静かなストーリー一覧が見えます。その裏側では、記事を見つけ、トーンと相性でフィルターし、役立つ要約を用意し、実用的なクラウド基盤でサイトを動かしています。",
    workflow: [
      {
        step: "発見",
        title: "新しい物語は出版社のフィードから届く",
        description:
          "NutsNewsは実際の出版社のRSSソースから始まり、サイトの雰囲気に合いそうな新しい記事を継続的に確認します。",
        Icon: DiscoverIcon,
      },
      {
        step: "選別",
        title: "AIがフィードの雰囲気を守る",
        description:
          "キュレーション層はストレスの強い話題を避け、建設的で、人間味があり、役立ち、希望を感じられる、またはただ楽しい物語を優先します。",
        Icon: FilterIcon,
      },
      {
        step: "要約",
        title: "読者にはまず穏やかな版を届ける",
        description:
          "承認された記事は短い要約、メタデータ、カテゴリーとともに表示され、フィードを速く、読みやすく、探索しやすく保ちます。",
        Icon: SummaryIcon,
      },
      {
        step: "元記事へ",
        title: "元の出版社が最終的な目的地",
        description:
          "NutsNewsは記事を置き換えようとはしません。すべてのストーリーは元のソースへ戻り、読者は報じた出版社で続きを読めます。",
        Icon: ExternalStoryIcon,
      },
    ],
    valuesEyebrow: "意図を持って構築",
    valuesTitle: "プロダクトの価値観",
    valuesDescription:
      "すべての技術的な判断は、より気持ちのよい物語へ素早くアクセスでき、気を散らすものが少なく、成長しても使いにくくならない体験を支えています。",
    principles: [
      {
        title: "穏やかなテクノロジー",
        description:
          "NutsNewsの裏側のエンジニアリングは、背景に溶け込むことを目指しています。Workers、キャッシュ、監視、ダッシュボードはすべて、速く、安定し、穏やかなサイトという約束を支えます。",
      },
      {
        title: "人を中心にしたキュレーション",
        description:
          "AIは好みの代わりではなく、助けとして使います。プロダクトは、ストレスの少ない見出しと、少し笑顔になれる物語を増やすという明確な編集方針で形づくられています。",
      },
      {
        title: "軽くてしなやか",
        description:
          "プラットフォームは少しずつ拡張できる実用的なツールで作られています。サイトにはNext.js、自動化にはCloudflare Workers、保存にはSupabase、デプロイにはVercel、信頼性には監視を使っています。",
      },
      {
        title: "成長する余地",
        description:
          "NutsNewsはまだ進化中です。基盤は、より多くのフィード、豊かなカテゴリー、よりよいダッシュボード、賢い品質管理、Webとモバイルでの滑らかな体験を支えられます。",
      },
    ],
    biggerEyebrow: "より大きな考え",
    biggerTitle:
      "NutsNewsは、ポジティブな物語にも優れたプロダクトデザインがふさわしいことを思い出させてくれます。",
    biggerBody:
      "最高のNutsNewsは、温かく、役に立ち、信頼でき、また戻ってきやすいものです。嵐の中に入るのではなく、窓を開けるように感じられるべきです。このプロジェクトが伝えたいのは、テクノロジーはメディアをもっとやさしく、集中しやすく、人間的にできるということです。",
  },
};

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300/80">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-amber-50 sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 text-sm leading-7 text-neutral-300 sm:text-base sm:leading-8">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function LocalizedAboutPage() {
  const selectedLanguage = useSelectedLanguage();
  const copy = aboutCopyByLanguage[selectedLanguage];

  return (
    <main
      lang={selectedLanguage}
      className="public-themed-page modern-home-shell min-h-screen overflow-hidden pb-28 text-[var(--theme-text)]"
    >
      <section className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-amber-300/15 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.24),_transparent_38%),linear-gradient(135deg,_#171717,_#0a0a0a_58%,_#451a03)] p-5 shadow-2xl shadow-black/40 ring-1 ring-amber-300/5 sm:p-8">
          <div className="rounded-[1.5rem] border border-amber-300/15 bg-black/30 p-5 shadow-inner shadow-amber-950/10 sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-300/80">
              {copy.heroEyebrow}
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-tight text-amber-50 sm:text-6xl">
              {copy.heroTitle}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-neutral-300 sm:text-lg sm:leading-9">
              {copy.heroBody}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-full border border-amber-300/30 bg-amber-300 px-5 py-2 text-sm font-black text-neutral-950 transition hover:bg-amber-200"
              >
                {copy.readStories}
              </Link>
              <Link
                href="/contact"
                className="rounded-full border border-amber-300/25 bg-amber-300/10 px-5 py-2 text-sm font-bold text-amber-100 transition hover:bg-amber-300/20"
              >
                {copy.contact}
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-neutral-900/80 p-5 shadow-xl shadow-black/25 sm:p-7">
          <SectionHeading
            eyebrow={copy.whyEyebrow}
            title={copy.whyTitle}
            description={copy.whyDescription}
          />

          <div className="grid gap-3 md:grid-cols-3">
            {copy.promises.map((promise) => (
              <article
                key={promise.title}
                className="rounded-3xl border border-white/10 bg-black/25 p-5"
              >
                <h3 className="text-base font-black text-amber-100">
                  {promise.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-neutral-300">
                  {promise.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/15 sm:p-7">
          <SectionHeading
            eyebrow={copy.nameEyebrow}
            title={copy.nameTitle}
            description={copy.nameDescription}
          />

          <div className="rounded-3xl border border-amber-300/15 bg-black/25 p-5">
            <div className="space-y-4 text-sm leading-8 text-neutral-300 sm:text-base sm:leading-8">
              {copy.nameStory.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/15 sm:p-7">
          <SectionHeading
            eyebrow={copy.habitEyebrow}
            title={copy.habitTitle}
            description={copy.habitDescription}
          />

          <div className="rounded-3xl border border-amber-300/15 bg-black/25 p-5">
            <p className="text-sm leading-8 text-neutral-300 sm:text-base sm:leading-8">
              {copy.habitBody}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-neutral-900/80 p-5 shadow-xl shadow-black/25 sm:p-7">
          <SectionHeading
            eyebrow={copy.builtEyebrow}
            title={copy.builtTitle}
            description={copy.builtDescription}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            {copy.builtFeatures.map((feature) => (
              <div
                key={feature}
                className="rounded-3xl border border-white/10 bg-black/20 p-4"
              >
                <p className="text-sm font-semibold leading-6 text-neutral-200">
                  {feature}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/15 sm:p-7">
          <SectionHeading
            eyebrow={copy.workflowEyebrow}
            title={copy.workflowTitle}
            description={copy.workflowDescription}
          />

          <div className="grid gap-4">
            {copy.workflow.map((item) => {
              const Icon = item.Icon;

              return (
                <article
                  key={item.step}
                  className="rounded-3xl border border-amber-300/15 bg-black/25 p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-300/30 bg-amber-400/15 text-amber-200 shadow-lg shadow-amber-950/20">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300/75">
                        {item.step}
                      </p>
                      <h3 className="mt-1 text-lg font-black text-amber-50">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-neutral-300">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-neutral-900/80 p-5 shadow-xl shadow-black/25 sm:p-7">
          <SectionHeading
            eyebrow={copy.valuesEyebrow}
            title={copy.valuesTitle}
            description={copy.valuesDescription}
          />

          <div className="grid gap-3 md:grid-cols-2">
            {copy.principles.map((principle) => (
              <article
                key={principle.title}
                className="rounded-3xl border border-white/10 bg-black/20 p-5 transition hover:border-amber-300/30"
              >
                <h3 className="text-base font-black text-amber-100">
                  {principle.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-neutral-300">
                  {principle.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-amber-300/15 bg-[radial-gradient(circle_at_bottom_left,_rgba(245,158,11,0.18),_transparent_34%),linear-gradient(135deg,_#0a0a0a,_#171717_58%,_#451a03)] p-5 shadow-2xl shadow-black/40 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-300/80">
            {copy.biggerEyebrow}
          </p>
          <h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight text-amber-50 sm:text-5xl">
            {copy.biggerTitle}
          </h2>
          <p className="mt-5 max-w-3xl text-sm leading-8 text-neutral-300 sm:text-base sm:leading-8">
            {copy.biggerBody}
          </p>
        </section>
      </section>

      <SiteFooter />
    </main>
  );
}
