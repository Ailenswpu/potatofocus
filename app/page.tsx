import PotatoApp from "@/components/PotatoApp";

const siteUrl = "https://potatofocus.app";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "potatofocus",
      description:
        "A minimal pomodoro timer for focused work and study sessions.",
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#app`,
      name: "potatofocus",
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Web",
      url: siteUrl,
      description:
        "A no-login pomodoro timer with ambient focus sounds, daily progress tracking, country-aware profiles, and a global leaderboard.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "25-minute focus sessions",
        "Short and long break timers",
        "Ambient focus audio",
        "Daily progress target",
        "Global leaderboard",
        "Country-aware profile flag",
      ],
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PotatoApp />
    </>
  );
}
