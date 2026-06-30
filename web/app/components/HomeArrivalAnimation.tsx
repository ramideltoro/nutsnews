"use client";

import { useEffect } from "react";

const FOOTER_HOME_TRANSITION_KEY = "nutsnews.footerHomeTransition";
const HOME_ARRIVAL_CLASS = "nutsnews-home-arrival";

export function HomeArrivalAnimation() {
  useEffect(() => {
    let shouldAnimate = false;

    try {
      shouldAnimate =
        window.sessionStorage.getItem(FOOTER_HOME_TRANSITION_KEY) === "1";
      window.sessionStorage.removeItem(FOOTER_HOME_TRANSITION_KEY);
    } catch {
      shouldAnimate = false;
    }

    if (!shouldAnimate) {
      return;
    }

    const root = document.documentElement;
    root.classList.remove(HOME_ARRIVAL_CLASS);

    window.requestAnimationFrame(() => {
      root.classList.add(HOME_ARRIVAL_CLASS);
    });

    const cleanupTimer = window.setTimeout(() => {
      root.classList.remove(HOME_ARRIVAL_CLASS);
    }, 900);

    return () => {
      window.clearTimeout(cleanupTimer);
      root.classList.remove(HOME_ARRIVAL_CLASS);
    };
  }, []);

  return null;
}
