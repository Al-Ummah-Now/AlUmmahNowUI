/**
 * The About page's blocks as the CMS seeds them (AlUmmahNowCMS migrations 0022 + 0023): a full-width
 * hero, the five-item "What you'll find here" feature list and a "Get started" note, en + ar. The stub
 * CMS (e2e/stub-cms.ts) serves them for /about/, so local E2E renders the page the way production does
 * (e2e/no-sideways-scroll.spec.ts measures it).
 */
import { normalizePageBlocks, servePageBlocks } from '../../../packages/render/src/page-blocks/page-blocks.generated.ts';

const SEED = {
  "en": [
    {
      "id": "hero",
      "type": "hero",
      "appearance": {
        "align": "center",
        "width": "full",
        "tone": "night",
        "space": "l"
      },
      "eyebrow": "",
      "title": "",
      "subtitle": "Al Ummah Now is a platform where you can share videos, Shorts and community posts.",
      "background": "gradient",
      "media_id": null,
      "alt": "",
      "height": "m",
      "buttons": []
    },
    {
      "id": "find",
      "type": "stats",
      "appearance": {
        "align": "center",
        "width": "wide",
        "tone": "soft",
        "space": "m"
      },
      "heading": "What you'll find here",
      "variant": "features",
      "items": [
        {
          "value": "",
          "label": "Watch and share videos and Shorts.",
          "text": "",
          "icon": "play"
        },
        {
          "value": "",
          "label": "Read community posts from the channels you subscribe to.",
          "text": "",
          "icon": "posts"
        },
        {
          "value": "",
          "label": "Share news that matters to the Ummah.",
          "text": "",
          "icon": "news"
        },
        {
          "value": "",
          "label": "Share your videos and posts with the community.",
          "text": "",
          "icon": "users"
        },
        {
          "value": "",
          "label": "Watch live streams as they happen.",
          "text": "",
          "icon": "live"
        }
      ]
    },
    {
      "id": "start",
      "type": "markdown",
      "appearance": {
        "align": "center",
        "width": "content",
        "tone": "soft",
        "space": "m"
      },
      "text": "## Get started\n\nExplore videos, or create an account to subscribe to channels and save what you want to come back to."
    }
  ],
  "ar": [
    {
      "id": "hero",
      "type": "hero",
      "appearance": {
        "align": "center",
        "width": "full",
        "tone": "night",
        "space": "l"
      },
      "eyebrow": "",
      "title": "",
      "subtitle": "الأمة الآن منصة تشارك فيها المرئيات والمقاطع القصيرة ومنشورات المجتمع.",
      "background": "gradient",
      "media_id": null,
      "alt": "",
      "height": "m",
      "buttons": []
    },
    {
      "id": "find",
      "type": "stats",
      "appearance": {
        "align": "center",
        "width": "wide",
        "tone": "soft",
        "space": "m"
      },
      "heading": "ماذا تجد هنا؟",
      "variant": "features",
      "items": [
        {
          "value": "",
          "label": "شاهد المرئيات والمقاطع القصيرة وشاركها.",
          "text": "",
          "icon": "play"
        },
        {
          "value": "",
          "label": "اقرأ منشورات المجتمع من القنوات التي تشترك فيها.",
          "text": "",
          "icon": "posts"
        },
        {
          "value": "",
          "label": "شارك الأخبار التي تهمّ الأمة.",
          "text": "",
          "icon": "news"
        },
        {
          "value": "",
          "label": "شارك مرئياتك ومنشوراتك مع المجتمع.",
          "text": "",
          "icon": "users"
        },
        {
          "value": "",
          "label": "شاهد البث المباشر لحظة بلحظة.",
          "text": "",
          "icon": "live"
        }
      ]
    },
    {
      "id": "start",
      "type": "markdown",
      "appearance": {
        "align": "center",
        "width": "content",
        "tone": "soft",
        "space": "m"
      },
      "text": "## ابدأ الآن\n\nاستكشف المرئيات، أو أنشئ حسابًا لتشترك في القنوات وتحفظ ما تريد الرجوع إليه."
    }
  ]
} as const;

const NO_REFS = { media: () => null, snapshot: () => null, posts: () => [] };

/** The About page's served blocks for a locale. */
export const aboutBlocks = (locale: 'en' | 'ar') => servePageBlocks(normalizePageBlocks(structuredClone(SEED[locale])), NO_REFS);
