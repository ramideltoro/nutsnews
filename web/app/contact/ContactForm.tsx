"use client";

import { FormEvent, useState } from "react";

import { type LanguageCode } from "@/lib/languages";
import { useSelectedLanguage } from "../components/useSelectedLanguage";

type FormStatus =
  | { type: "idle" }
  | { type: "sending" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

const formCopyByLanguage: Record<
  LanguageCode,
  {
    hiddenWebsite: string;
    emailLabel: string;
    emailPlaceholder: string;
    messageLabel: string;
    messagePlaceholder: string;
    privacyNote: string;
    send: string;
    sending: string;
    genericError: string;
    connectionError: string;
    success: string;
  }
> = {
  en: {
    hiddenWebsite: "Website",
    emailLabel: "Your email",
    emailPlaceholder: "you@example.com",
    messageLabel: "Message",
    messagePlaceholder: "Tell me what you want to share about NutsNews.",
    privacyNote:
      "Your email is used only so NutsNews can reply to this message.",
    send: "Send",
    sending: "Sending...",
    genericError:
      "Your message could not be sent. Please try again in a moment.",
    connectionError:
      "Your message could not be sent. Please check your connection.",
    success: "Thanks. Your message was sent to NutsNews.",
  },
  fr: {
    hiddenWebsite: "Site web",
    emailLabel: "Votre email",
    emailPlaceholder: "vous@exemple.com",
    messageLabel: "Message",
    messagePlaceholder: "Dites-moi ce que vous voulez partager avec NutsNews.",
    privacyNote:
      "Votre email est utilisé uniquement pour que NutsNews puisse répondre à ce message.",
    send: "Envoyer",
    sending: "Envoi...",
    genericError:
      "Votre message n’a pas pu être envoyé. Veuillez réessayer dans un instant.",
    connectionError:
      "Votre message n’a pas pu être envoyé. Veuillez vérifier votre connexion.",
    success: "Merci. Votre message a été envoyé à NutsNews.",
  },
  ja: {
    hiddenWebsite: "ウェブサイト",
    emailLabel: "メールアドレス",
    emailPlaceholder: "you@example.com",
    messageLabel: "メッセージ",
    messagePlaceholder: "NutsNewsに伝えたいことを書いてください。",
    privacyNote:
      "メールアドレスは、このメッセージにNutsNewsが返信するためだけに使われます。",
    send: "送信",
    sending: "送信中...",
    genericError:
      "メッセージを送信できませんでした。少ししてからもう一度お試しください。",
    connectionError:
      "メッセージを送信できませんでした。接続を確認してください。",
    success: "ありがとうございます。メッセージはNutsNewsに送信されました。",
  },
};

export function ContactForm() {
  const selectedLanguage = useSelectedLanguage();
  const copy = formCopyByLanguage[selectedLanguage];
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<FormStatus>({ type: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ type: "sending" });

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, message, website }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setStatus({
          type: "error",
          message: result.error ?? copy.genericError,
        });
        return;
      }

      setEmail("");
      setMessage("");
      setWebsite("");
      setStatus({
        type: "success",
        message: copy.success,
      });
    } catch {
      setStatus({
        type: "error",
        message: copy.connectionError,
      });
    }
  }

  const isSending = status.type === "sending";

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 rounded-[2rem] border border-amber-300/15 bg-black/25 p-5 shadow-xl shadow-amber-950/15"
    >
      <div className="hidden" aria-hidden="true">
        <label htmlFor="contact-website">{copy.hiddenWebsite}</label>
        <input
          id="contact-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <label
        htmlFor="contact-email"
        className="text-xs font-black uppercase tracking-[0.22em] text-amber-300/80"
      >
        {copy.emailLabel}
      </label>
      <input
        id="contact-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        maxLength={320}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder={copy.emailPlaceholder}
        className="mt-2 w-full rounded-2xl border border-amber-300/15 bg-neutral-950/80 px-4 py-3 text-sm text-neutral-100 outline-none ring-0 transition placeholder:text-neutral-600 focus:border-amber-300/60 focus:bg-neutral-950 focus:shadow-[0_0_0_4px_rgba(245,158,11,0.12)]"
      />

      <label
        htmlFor="contact-message"
        className="mt-5 block text-xs font-black uppercase tracking-[0.22em] text-amber-300/80"
      >
        {copy.messageLabel}
      </label>
      <textarea
        id="contact-message"
        name="message"
        required
        minLength={10}
        maxLength={4000}
        rows={7}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={copy.messagePlaceholder}
        className="mt-2 w-full resize-none rounded-2xl border border-amber-300/15 bg-neutral-950/80 px-4 py-3 text-sm leading-7 text-neutral-100 outline-none ring-0 transition placeholder:text-neutral-600 focus:border-amber-300/60 focus:bg-neutral-950 focus:shadow-[0_0_0_4px_rgba(245,158,11,0.12)]"
      />

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-neutral-500">{copy.privacyNote}</p>
        <button
          type="submit"
          disabled={isSending}
          className="shrink-0 rounded-full border border-amber-300/25 bg-amber-400/15 px-5 py-3 text-sm font-black text-amber-100 transition hover:border-amber-200/60 hover:bg-amber-300 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-amber-400/15 disabled:hover:text-amber-100"
        >
          {isSending ? copy.sending : copy.send}
        </button>
      </div>

      <div aria-live="polite" className="mt-4 min-h-6">
        {status.type === "success" ? (
          <p className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200">
            {status.message}
          </p>
        ) : null}

        {status.type === "error" ? (
          <p className="rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">
            {status.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
