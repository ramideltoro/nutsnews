export const OG_IMAGE_SIZE = {
  width: 1200,
  height: 630,
};

const TITLE_MAX_LENGTH = 105;
const DESCRIPTION_MAX_LENGTH = 150;
const BADGE_MAX_LENGTH = 42;

type OgImageOptions = {
  eyebrow: string;
  title: string;
  description: string;
  badge?: string | null;
  footer?: string;
};

function truncateText(value: string | null | undefined, maxLength: number) {
  const trimmedValue = value?.replace(/\s+/g, " ").trim() ?? "";

  if (trimmedValue.length <= maxLength) {
    return trimmedValue;
  }

  return `${trimmedValue.slice(0, maxLength - 1).trim()}…`;
}

export function createOgImage({
  eyebrow,
  title,
  description,
  badge,
  footer = "Positive news, simplified · nutsnews.com",
}: OgImageOptions) {
  const safeEyebrow = truncateText(eyebrow, BADGE_MAX_LENGTH);
  const safeTitle = truncateText(title, TITLE_MAX_LENGTH);
  const safeDescription = truncateText(description, DESCRIPTION_MAX_LENGTH);
  const safeBadge = truncateText(badge, BADGE_MAX_LENGTH);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        background:
          "linear-gradient(135deg, #050505 0%, #17120a 52%, #451a03 100%)",
        color: "#fff7ed",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        padding: 72,
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -80,
          top: -110,
          display: "flex",
          height: 330,
          width: 330,
          borderRadius: 999,
          background: "rgba(245, 158, 11, 0.22)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -150,
          left: -120,
          display: "flex",
          height: 360,
          width: 360,
          borderRadius: 999,
          background: "rgba(251, 191, 36, 0.14)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 30,
          right: 30,
          bottom: 30,
          left: 30,
          display: "flex",
          border: "1px solid rgba(251, 191, 36, 0.22)",
          borderRadius: 46,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          width: "100%",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              height: 78,
              width: 78,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 24,
              border: "1px solid rgba(252, 211, 77, 0.4)",
              background: "rgba(0, 0, 0, 0.32)",
              color: "#fcd34d",
              fontSize: 46,
              fontWeight: 950,
              lineHeight: 1,
            }}
          >
            N
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                display: "flex",
                color: "#fbbf24",
                fontSize: 38,
                fontWeight: 950,
                letterSpacing: -1.1,
              }}
            >
              NutsNews
            </div>
            <div
              style={{
                display: "flex",
                color: "rgba(254, 243, 199, 0.72)",
                fontSize: 21,
                fontWeight: 700,
                letterSpacing: 3.8,
                textTransform: "uppercase",
              }}
            >
              {safeEyebrow}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {safeBadge ? (
            <div
              style={{
                display: "flex",
                borderRadius: 999,
                border: "1px solid rgba(252, 211, 77, 0.3)",
                background: "rgba(245, 158, 11, 0.14)",
                color: "#fde68a",
                fontSize: 24,
                fontWeight: 850,
                padding: "13px 22px",
              }}
            >
              {safeBadge}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              maxWidth: 970,
              color: "#ffffff",
              fontSize: safeTitle.length > 76 ? 58 : 68,
              fontWeight: 950,
              letterSpacing: -2.5,
              lineHeight: 1.03,
            }}
          >
            {safeTitle}
          </div>

          <div
            style={{
              display: "flex",
              maxWidth: 910,
              color: "rgba(245, 245, 244, 0.78)",
              fontSize: 30,
              fontWeight: 560,
              lineHeight: 1.28,
            }}
          >
            {safeDescription}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "rgba(254, 243, 199, 0.8)",
            fontSize: 24,
            fontWeight: 750,
          }}
        >
          <span>{footer}</span>
          <span style={{ color: "#fbbf24" }}>Read something good today</span>
        </div>
      </div>
    </div>
  );
}
