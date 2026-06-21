import { RotateCcw, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

import { Button, ConfirmDialog, EmptyState } from '../components/ui';
import { useCardsQuery, usePermanentlyDeleteCardMutation, useRestoreCardMutation } from '../queries/cards';
import { useUiStore } from '../stores/uiStore';

export function Trash() {
  const [pendingPermanentDeleteId, setPendingPermanentDeleteId] = useState<string | null>(null);
  const cardsQuery = useCardsQuery(undefined, true);
  const restoreMutation = useRestoreCardMutation();
  const permanentlyDeleteMutation = usePermanentlyDeleteCardMutation();
  const showToast = useUiStore((state) => state.showToast);
  const deletedCards = (cardsQuery.data ?? []).filter((card) => card.deletedAt || card.isDeleted);

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto max-w-[880px] px-12 py-16">
        <header className="mb-10">
          <h1 className="text-[32px] font-semibold tracking-tight text-[#1A1A1A]">回收站</h1>
          <p className="mt-2 text-[14px] text-[#868E96]">已删除内容会先保留在这里，确认无误后再永久删除。</p>
        </header>

        {deletedCards.length === 0 ? (
          <EmptyState title="回收站为空" description="删除的知识卡会先出现在这里。" />
        ) : (
          <div className="space-y-4">
            {deletedCards.map((card) => (
              <div className="rounded-2xl border border-[#EAEAEA] bg-[#F8F9FA] p-5" key={card.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="line-clamp-2 text-[16px] font-medium text-[#1A1A1A]">{card.userTitle || card.title}</h2>
                    <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-[#868E96]">{card.userSummary || card.summary || card.contentPreview}</p>
                    <p className="mt-3 text-[12px] text-[#ADB5BD]">删除时间：{card.deletedAt ? format(new Date(card.deletedAt), 'yyyy-MM-dd HH:mm') : '-'}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      loading={restoreMutation.isPending}
                      onClick={() => restoreMutation.mutate(card.id, { onSuccess: () => showToast('已恢复知识卡') })}
                      variant="secondary"
                    >
                      <RotateCcw size={14} />
                      恢复
                    </Button>
                    <Button
                      loading={permanentlyDeleteMutation.isPending}
                      onClick={() => setPendingPermanentDeleteId(card.id)}
                      variant="danger"
                    >
                      <Trash2 size={14} />
                      永久删除
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {pendingPermanentDeleteId && (
        <ConfirmDialog
          confirmLabel="永久删除"
          description="永久删除后无法从回收站恢复，请确认这张知识卡已经不再需要。"
          onCancel={() => setPendingPermanentDeleteId(null)}
          onConfirm={() => {
            permanentlyDeleteMutation.mutate(pendingPermanentDeleteId, { onSuccess: () => showToast('已永久删除') });
            setPendingPermanentDeleteId(null);
          }}
          title="确认永久删除？"
        />
      )}
    </div>
  );
}
