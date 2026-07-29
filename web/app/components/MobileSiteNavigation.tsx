"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type MobileSiteNavigationLink = {
  href: string;
  label: string;
};

function MenuIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`mobile-site-navigation__icon ${
        isOpen ? "mobile-site-navigation__icon--open" : ""
      }`}
    >
      <span className="mobile-site-navigation__icon-line" />
      <span className="mobile-site-navigation__icon-line" />
      <span className="mobile-site-navigation__icon-line" />
    </span>
  );
}

export function MobileSiteNavigation({
  links,
  navigationLabel,
  openLabel,
  closeLabel,
}: {
  links: readonly MobileSiteNavigationLink[];
  navigationLabel: string;
  openLabel: string;
  closeLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        toggleRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="mobile-site-navigation">
      <button
        ref={toggleRef}
        type="button"
        data-testid="nutsnews-footer-menu"
        className="footer-icon-button mobile-site-navigation__toggle"
        aria-label={isOpen ? closeLabel : openLabel}
        aria-expanded={isOpen}
        aria-controls="nutsnews-mobile-navigation-panel"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="footer-icon-button__halo" />
        <MenuIcon isOpen={isOpen} />
      </button>

      {isOpen ? (
        <nav
          id="nutsnews-mobile-navigation-panel"
          data-testid="nutsnews-footer-menu-panel"
          aria-label={navigationLabel}
          className="mobile-site-navigation__panel"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="mobile-site-navigation__link"
              onClick={() => setIsOpen(false)}
            >
              {link.label}
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
