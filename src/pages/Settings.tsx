import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, KeyRound, Loader2, LogIn, RefreshCw, Upload } from 'lucide-react';

import { getFeedgrabLoginStatus, getRuntimeConfig, startFeedgrabLogin, type FeedgrabLoginPlatform, type FeedgrabLoginStatusResponse, type RuntimeConfigStatus, updateRuntimeConfig } from '../api/settings';
import { Button } from '../components/ui';
import { apiBaseUrl, resolveDataSource } from '../api/client';
import { useUiStore } from '../stores/uiStore';

type FormState = {
  siliconflowApiKey: string;
  siliconflowBaseUrl: string;
  chatApiKey: string;
  chatBaseUrl: string;
  chatModel: string;
  embeddingApiKey: string;
  embeddingBaseUrl: string;
  embeddingModel: string;
  rerankApiKey: string;
  rerankApiUrl: string;
  rerankModel: string;
  useLancedb: boolean;
};

const initialForm: FormState = {
  siliconflowApiKey: '',
  siliconflowBaseUrl: 'https://api.siliconflow.cn/v1',
  chatApiKey: '',
  chatBaseUrl: 'https://api.siliconflow.cn/v1',
  chatModel: 'deepseek-ai/DeepSeek-V4-Flash',
  embeddingApiKey: '',
  embeddingBaseUrl: 'https://api.siliconflow.cn/v1',
  embeddingModel: 'Qwen/Qwen3-Embedding-0.6B',
  rerankApiKey: '',
  rerankApiUrl: '',
  rerankModel: '',
  useLancedb: false,
};

const feedgrabLoginOptions: Array<{ platform: FeedgrabLoginPlatform; title: string; description: string }> = [
  { platform: 'x', title: 'X', description: '用于抓取推文、长文、书签和搜索结果。' },
  { platform: 'xhs', title: '小红书', description: '用于抓取需要登录态的小红书笔记和作者内容。' },
  { platform: 'wechat', title: '微信', description: '用于公众号历史文章等需要登录态的抓取。' },
];

function applyStatusToForm(status: RuntimeConfigStatus): FormState {
  return {
    ...initialForm,
    siliconflowBaseUrl: status.siliconflowBaseUrl || initialForm.siliconflowBaseUrl,
    chatBaseUrl: status.chatBaseUrl || initialForm.chatBaseUrl,
    chatModel: status.chatModel || initialForm.chatModel,
    embeddingBaseUrl: status.embeddingBaseUrl || initialForm.embeddingBaseUrl,
    embeddingModel: status.embeddingModel || initialForm.embeddingModel,
    rerankApiUrl: status.rerankApiUrl,
    rerankModel: status.rerankModel,
    useLancedb: status.useLancedb,
  };
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ${active ? 'bg-[#E7F5FF] text-[#1971C2]' : 'bg-[#F1F3F5] text-[#868E96]'}`}>
      {active && <CheckCircle2 size={13} />}
      {label}{active ? '已配置' : '未配置'}
    </span>
  );
}

function LoginStatusPill({ loggedIn, state }: { loggedIn: boolean; state?: string }) {
  const label = loggedIn ? '已登录' : state === 'stale' || state === 'invalid' ? '需重新登录' : '未登录';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ${loggedIn ? 'bg-[#EBFBEE] text-[#2B8A3E]' : 'bg-[#FFF5F5] text-[#C92A2A]'}`}>
      {loggedIn && <CheckCircle2 size={13} />}
      {label}
    </span>
  );
}

function formatLoginUpdatedAt(updatedAt?: string) {
  if (!updatedAt) return '';
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Field({
  label,
  onChange,
  placeholder,
  type = 'text',
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-[#495057]">{label}</span>
      <input
        className="mt-2 h-11 w-full rounded-xl border border-[#EAEAEA] bg-white px-3 text-[14px] text-[#212529] outline-none transition-colors placeholder:text-[#ADB5BD] focus:border-[#339AF0]"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

export function Settings() {
  const dataSource = resolveDataSource();
  const hasApiBaseUrl = Boolean(apiBaseUrl);
  const showToast = useUiStore((state) => state.showToast);
  const [status, setStatus] = useState<RuntimeConfigStatus | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loggingInPlatform, setLoggingInPlatform] = useState<FeedgrabLoginPlatform | null>(null);
  const [loginStatus, setLoginStatus] = useState<FeedgrabLoginStatusResponse | null>(null);
  const [isLoginStatusLoading, setIsLoginStatusLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loginStatusError, setLoginStatusError] = useState('');

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    getRuntimeConfig()
      .then((nextStatus) => {
        if (ignore) return;
        setStatus(nextStatus);
        setForm(applyStatusToForm(nextStatus));
        setLoadError('');
      })
      .catch((error: Error) => {
        if (ignore) return;
        setLoadError(error.message);
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const refreshFeedgrabLoginStatus = async () => {
    setIsLoginStatusLoading(true);
    try {
      const nextStatus = await getFeedgrabLoginStatus();
      setLoginStatus(nextStatus);
      setLoginStatusError('');
    } catch (error) {
      setLoginStatusError(error instanceof Error ? error.message : '登录态检测失败');
    } finally {
      setIsLoginStatusLoading(false);
    }
  };

  useEffect(() => {
    void refreshFeedgrabLoginStatus();
  }, []);

  const updateField = <TField extends keyof FormState>(field: TField, value: FormState[TField]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const nextStatus = await updateRuntimeConfig(form);
      setStatus(nextStatus);
      setForm(applyStatusToForm(nextStatus));
      showToast('模型 API 配置已保存');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '模型 API 配置保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFeedgrabLogin = async (platform: FeedgrabLoginPlatform, title: string) => {
    setLoggingInPlatform(platform);
    try {
      await startFeedgrabLogin(platform);
      showToast(`已打开 ${title} 登录窗口，请在浏览器完成授权`);
      window.setTimeout(() => void refreshFeedgrabLoginStatus(), 1500);
    } catch (error) {
      showToast(error instanceof Error ? error.message : `${title} 登录启动失败`);
    } finally {
      setLoggingInPlatform(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto max-w-[920px] px-12 py-16">
        <header className="mb-10">
          <h1 className="text-[32px] font-semibold tracking-tight text-[#1A1A1A]">设置</h1>
          <p className="mt-2 text-[14px] text-[#868E96]">模型、数据源、备份与导出。</p>
        </header>

        <section className="mb-8 rounded-2xl border border-[#EAEAEA] bg-[#F8F9FA] p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#868E96]">
              <KeyRound size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[16px] font-semibold text-[#1A1A1A]">API 与模型配置</h2>
                  <p className="mt-1 text-[13px] text-[#868E96]">Chat、Embedding、Rerank 会保存到后端运行配置，并立即重载本地 RAG 服务。默认优先走 SiliconFlow；只有显式填写独立 Chat Key 时，才会切到单独的 Chat 服务。</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill active={Boolean(status?.chatConfigured)} label="Chat " />
                  <StatusPill active={Boolean(status?.embeddingConfigured)} label="Embedding " />
                  <StatusPill active={Boolean(status?.rerankConfigured)} label="Rerank " />
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-[14px] text-[#495057]">
                <div className="flex justify-between gap-4 rounded-xl bg-white px-4 py-3">
                  <span className="text-[#868E96]">数据源</span>
                  <span className="font-medium">{dataSource === 'mock' ? 'Mock 数据' : '真实 API'}</span>
                </div>
                <div className="flex justify-between gap-4 rounded-xl bg-white px-4 py-3">
                  <span className="text-[#868E96]">前端 API 地址</span>
                  <span className="truncate font-medium">{apiBaseUrl || '未配置'}</span>
                </div>
                <div className="flex justify-between gap-4 rounded-xl bg-white px-4 py-3">
                  <span className="text-[#868E96]">后端配置文件</span>
                  <span className="truncate font-medium">{status?.configPath || 'backend/data/runtime_config.json'}</span>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[#D0EBFF] bg-[#EEF7FF] px-4 py-3 text-[13px] text-[#1864AB]">
                先填写 SiliconFlow API Key，即可开始使用导入、摘要、搜索和问答。
              </div>

              {!hasApiBaseUrl && dataSource === 'real' && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#FFE3E3] bg-[#FFF5F5] px-4 py-3 text-[13px] text-[#C92A2A]">
                  <AlertCircle className="mt-0.5 shrink-0" size={16} />
                  <span>真实 API 模式需要配置 VITE_API_BASE_URL，否则导入、搜索和生成能力会失败。</span>
                </div>
              )}
              {loadError && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#FFE3E3] bg-[#FFF5F5] px-4 py-3 text-[13px] text-[#C92A2A]">
                  <AlertCircle className="mt-0.5 shrink-0" size={16} />
                  <span>{loadError}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-[#EAEAEA] bg-white p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-semibold text-[#1A1A1A]">模型服务</h2>
              <p className="mt-1 text-[13px] text-[#868E96]">只填 SiliconFlow Key 时会自动复用于 Chat、Embedding 和 Rerank；需要单独直连 Chat 服务时，再填写独立 Chat Key 和对应模型。</p>
            </div>
            {isLoading && <Loader2 className="animate-spin text-[#868E96]" size={18} />}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="SiliconFlow API Key"
              onChange={(value) => updateField('siliconflowApiKey', value)}
              placeholder={status?.siliconflowConfigured ? '已配置，留空则不修改' : 'sk-...'}
              type="password"
              value={form.siliconflowApiKey}
            />
            <Field label="SiliconFlow Base URL" onChange={(value) => updateField('siliconflowBaseUrl', value)} value={form.siliconflowBaseUrl} />
            <Field
              label="Chat API Key"
              onChange={(value) => updateField('chatApiKey', value)}
              placeholder={status?.chatConfigured ? '已配置，留空则保留当前独立 Chat Key' : '可留空回退到 SiliconFlow Key'}
              type="password"
              value={form.chatApiKey}
            />
            <Field label="Chat Base URL" onChange={(value) => updateField('chatBaseUrl', value)} value={form.chatBaseUrl} />
            <Field label="Chat Model" onChange={(value) => updateField('chatModel', value)} value={form.chatModel} />
            <Field
              label="Embedding API Key"
              onChange={(value) => updateField('embeddingApiKey', value)}
              placeholder={status?.embeddingConfigured ? '留空则清除独立配置并回退到 SiliconFlow Key' : '可留空回退到 SiliconFlow Key'}
              type="password"
              value={form.embeddingApiKey}
            />
            <Field label="Embedding Base URL" onChange={(value) => updateField('embeddingBaseUrl', value)} value={form.embeddingBaseUrl} />
            <Field label="Embedding Model" onChange={(value) => updateField('embeddingModel', value)} value={form.embeddingModel} />
            <Field
              label="Rerank API Key"
              onChange={(value) => updateField('rerankApiKey', value)}
              placeholder={status?.rerankConfigured ? '留空则清除独立配置并回退到 SiliconFlow Key' : '可留空回退到 SiliconFlow Key'}
              type="password"
              value={form.rerankApiKey}
            />
            <Field label="Rerank API URL" onChange={(value) => updateField('rerankApiUrl', value)} placeholder="https://.../rerank" value={form.rerankApiUrl} />
            <Field label="Rerank Model" onChange={(value) => updateField('rerankModel', value)} placeholder="可选" value={form.rerankModel} />
            <label className="flex h-11 items-center gap-3 self-end rounded-xl border border-[#EAEAEA] bg-[#F8F9FA] px-4 text-[14px] text-[#495057]">
              <input
                checked={form.useLancedb}
                className="h-4 w-4 accent-[#339AF0]"
                onChange={(event) => updateField('useLancedb', event.target.checked)}
                type="checkbox"
              />
              启用 LanceDB 向量索引
            </label>
          </div>

          <div className="mt-6 flex justify-end">
            <Button disabled={isSaving || isLoading} onClick={() => void handleSave()}>
              {isSaving ? '保存中...' : '保存配置'}
            </Button>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-[#EAEAEA] bg-white p-6">
          <div className="mb-5 flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F8F9FA] text-[#868E96]">
              <LogIn size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[16px] font-semibold text-[#1A1A1A]">feedgrab 平台登录态</h2>
                  <p className="mt-1 text-[13px] leading-6 text-[#868E96]">点击后会调用 feedgrab login 并打开浏览器。登录完成后，后续导入会复用本机保存的会话。</p>
                </div>
                <Button
                  icon={<RefreshCw size={16} />}
                  loading={isLoginStatusLoading}
                  onClick={() => void refreshFeedgrabLoginStatus()}
                  variant="secondary"
                >
                  刷新状态
                </Button>
              </div>
              {loginStatusError && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#FFE3E3] bg-[#FFF5F5] px-4 py-3 text-[13px] text-[#C92A2A]">
                  <AlertCircle className="mt-0.5 shrink-0" size={16} />
                  <span>{loginStatusError}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {feedgrabLoginOptions.map((option) => {
              const platformStatus = loginStatus?.platforms[option.platform];
              return (
                <div className="rounded-xl border border-[#EAEAEA] bg-[#F8F9FA] p-4" key={option.platform}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[14px] font-semibold text-[#1A1A1A]">{option.title}</h3>
                    <LoginStatusPill loggedIn={Boolean(platformStatus?.loggedIn)} state={platformStatus?.state} />
                  </div>
                  <p className="mt-2 min-h-12 text-[13px] leading-6 text-[#868E96]">{option.description}</p>
                  <div className="min-h-12 rounded-lg bg-white px-3 py-2 text-[12px] leading-5 text-[#868E96]">
                    <div>{platformStatus?.message || '正在检测登录态...'}</div>
                    {platformStatus?.updatedAt && <div>更新时间：{formatLoginUpdatedAt(platformStatus.updatedAt)}</div>}
                  </div>
                  <Button
                    className="mt-4 w-full"
                    icon={<LogIn size={16} />}
                    loading={loggingInPlatform === option.platform}
                    onClick={() => void handleFeedgrabLogin(option.platform, option.title)}
                    variant={platformStatus?.loggedIn ? 'ghost' : 'secondary'}
                  >
                    {platformStatus?.loggedIn ? `重新登录 ${option.title}` : `登录 ${option.title}`}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[#EAEAEA] bg-white p-6">
            <Upload className="mb-4 text-[#868E96]" size={22} />
            <h2 className="text-[16px] font-semibold text-[#1A1A1A]">备份</h2>
            <p className="mt-2 text-[13px] leading-6 text-[#868E96]">导出当前知识库元数据和索引配置，用于本地留档或迁移。</p>
            <Button className="mt-5" onClick={() => showToast('备份任务已加入队列')} variant="secondary">创建备份</Button>
          </div>
          <div className="rounded-2xl border border-[#EAEAEA] bg-white p-6">
            <Download className="mb-4 text-[#868E96]" size={22} />
            <h2 className="text-[16px] font-semibold text-[#1A1A1A]">导出</h2>
            <p className="mt-2 text-[13px] leading-6 text-[#868E96]">将选定内容导出为 Markdown 或 JSON，方便进入其他工具继续整理。</p>
            <Button className="mt-5" onClick={() => showToast('导出任务已加入队列')} variant="secondary">导出数据</Button>
          </div>
        </section>
      </div>
    </div>
  );
}
