import React from 'react';

const HASHTAG_REGEX = /(#[a-zA-Z0-9\u00C0-\u024F_]+)/g;

export function renderHashtags(text: string): React.ReactNode[] {
  const parts = text.split(HASHTAG_REGEX);
  return parts.map((part, i) =>
    HASHTAG_REGEX.test(part) ? (
      <span key={i} className="font-bold text-primary-600">
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}
