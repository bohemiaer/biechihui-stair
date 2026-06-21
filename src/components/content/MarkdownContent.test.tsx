import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarkdownContent } from './MarkdownContent';

describe('MarkdownContent', () => {
  it('renders markdown images through local card assets when available', () => {
    render(
      <MarkdownContent
        content="![小红书图片](https://sns-webpic-qc.xhscdn.com/demo.webp)"
        imageAssets={[
          {
            id: 'asset-1',
            cardId: 'card-1',
            sourceUrl: 'https://sns-webpic-qc.xhscdn.com/demo.webp',
            localPath: 'card_assets/card-1/01.webp',
            mimeType: 'image/webp',
            sortOrder: 0,
            status: 'downloaded',
            createdAt: '2026-06-20T00:00:00+00:00',
          },
        ]}
      />,
    );

    expect(screen.getByRole('img', { name: '小红书图片' })).toHaveAttribute(
      'src',
      'http://127.0.0.1:8001/api/assets/card_assets/card-1/01.webp',
    );
  });

  it('does not hotlink remote markdown images without a local copy', () => {
    render(<MarkdownContent content="![公众号图片](https://mmbiz.qpic.cn/demo.jpg)" />);

    expect(screen.queryByRole('img', { name: '公众号图片' })).not.toBeInTheDocument();
    expect(screen.getByText(/图片受来源站限制/)).toBeInTheDocument();
  });
});
