import React from 'react';

import { resolveAssetUrl } from '../../api/client';
import type { CardImageAsset } from '../../types';

type MarkdownContentProps = {
  content: string;
  imageAssets?: CardImageAsset[];
};

const imagePattern = /^!\[([^\]]*)\]\(([^)]+)\)$/;
const headingPattern = /^(#{1,6})\s+(.+)$/;
const bulletPattern = /^\s*[-*+]\s+(.+)$/;

function renderInline(text: string) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (!match) {
      return <React.Fragment key={index}>{part}</React.Fragment>;
    }
    return (
      <a
        className="text-[#2F6F68] underline underline-offset-4"
        href={match[2]}
        key={index}
        rel="noreferrer"
        target="_blank"
      >
        {match[1]}
      </a>
    );
  });
}

function resolveMarkdownImageSource(sourceUrl: string, imageAssets: CardImageAsset[]) {
  const normalizedSource = sourceUrl.trim();
  const asset = imageAssets.find((item) => item.sourceUrl === normalizedSource && item.localPath);
  if (asset?.localPath) {
    return resolveAssetUrl(asset.localPath);
  }
  if (/^https?:\/\//.test(normalizedSource)) {
    return '';
  }
  return normalizedSource;
}

export function MarkdownContent({ content, imageAssets = [] }: MarkdownContentProps) {
  const lines = content.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  let code: string[] = [];
  let inCode = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(' ').trim();
    if (text) {
      nodes.push(
        <p className="mb-4 break-words text-[15px] leading-[1.85] text-[#495057]" key={`p-${nodes.length}`}>
          {renderInline(text)}
        </p>,
      );
    }
    paragraph = [];
  };

  const flushBullets = () => {
    if (!bullets.length) return;
    nodes.push(
      <ul className="mb-5 list-disc space-y-2 pl-5 text-[15px] leading-[1.75] text-[#495057]" key={`ul-${nodes.length}`}>
        {bullets.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  const flushCode = () => {
    if (!code.length) return;
    nodes.push(
      <pre className="mb-5 overflow-x-auto rounded-lg bg-[#F1F3F5] p-4 text-[13px] leading-6 text-[#343A40]" key={`code-${nodes.length}`}>
        <code>{code.join('\n')}</code>
      </pre>,
    );
    code = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        flushBullets();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushBullets();
      continue;
    }

    const imageMatch = trimmed.match(imagePattern);
    if (imageMatch) {
      flushParagraph();
      flushBullets();
      const imageSource = resolveMarkdownImageSource(imageMatch[2], imageAssets);
      if (imageSource) {
        nodes.push(
          <figure className="mb-5 overflow-hidden rounded-lg border border-[#EAEAEA] bg-[#F8F9FA]" key={`img-${nodes.length}`}>
            <img alt={imageMatch[1]} className="max-h-[520px] w-full object-contain" loading="lazy" src={imageSource} />
          </figure>,
        );
      } else {
        nodes.push(
          <figure
            className="mb-5 rounded-lg border border-dashed border-[#D0D5DD] bg-[#F8F9FA] px-4 py-3 text-[13px] leading-6 text-[#868E96]"
            key={`img-${nodes.length}`}
          >
            图片受来源站限制，未直接加载。重新抓取后会优先使用本地保存的图片副本。
          </figure>,
        );
      }
      continue;
    }

    const headingMatch = trimmed.match(headingPattern);
    if (headingMatch) {
      flushParagraph();
      flushBullets();
      const level = headingMatch[1].length;
      const Tag = level <= 2 ? 'h3' : 'h4';
      nodes.push(
        <Tag className="mb-3 mt-7 break-words text-[18px] font-semibold leading-7 text-[#1A1A1A]" key={`h-${nodes.length}`}>
          {renderInline(headingMatch[2])}
        </Tag>,
      );
      continue;
    }

    const bulletMatch = trimmed.match(bulletPattern);
    if (bulletMatch) {
      flushParagraph();
      bullets.push(bulletMatch[1]);
      continue;
    }

    flushBullets();
    paragraph.push(trimmed);
  }

  flushCode();
  flushParagraph();
  flushBullets();

  return <div className="max-w-none">{nodes}</div>;
}
