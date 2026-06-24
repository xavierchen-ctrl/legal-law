# CLAUDE.md — Legal Flow 法務合約管理系統

> 這份文件給「Claude Code」與接手的工程師閱讀。一開啟專案請先看完本檔,能快速掌握架構、環境設定與部署流程。

## 專案是什麼

Legal Flow 是法務部門的**合約申請 / 審閱 / 追蹤 / 歸檔**工作流系統,並內建多項 **AI 合約工具**(比對、起草、翻譯、命名審查、報告、公司登記查驗等)。

- 線上服務透過 **Vercel** 部署,排程任務(掃描 Google Drive、寄送日報/週報)由 **Vercel Cron** 觸發。
- 資料同時存在 **PostgreSQL(Prisma)** 與 **Google Sheets**;DB 的 `ContractTracking` 是疊加在 Google Sheets 資料之上的進度追蹤層。

## 技術棧

- **框架**:Next.js 16(App Router)+ React 19 + TypeScript
- **樣式**:Tailwind CSS 3
- **資料庫**:PostgreSQL(疑似 Neon,有 pooled / unpooled 兩條連線)+ Prisma 6
- **AI**:Anthropic(`@anthropic-ai/sdk`)、OpenAI、Google Gemini —— 三家都有用,依功能切換
- **外部整合**:Google Sheets / Drive(`googleapis`,service account)、SMTP 寄信(`nodemailer`)、PDF 解析(`pdf-parse`)
- **排程**:Vercel Cron(設定在 `vercel.json`),本地另有 `node-cron`

## 快速上手(新環境)

```bash
git clone https://github.com/xavierchen-ctrl/legal-law.git
cd legal-law
npm install

# 取得環境變數:有 Vercel 權限的話直接 pull,不必手動貼密鑰
vercel login && vercel link      # 連到 Vercel 專案 legal-law
vercel env pull                  # 產生 .env.local

npx prisma generate              # 產生 Prisma client
npm run dev                      # http://localhost:3000
```

> ⚠️ 沒有 `.env.local` / `.env` 專案跑不起來(DB、AI、Google、SMTP 都靠它)。這兩個檔**不進 git**,務必透過 `vercel env pull` 或向交接人索取。

### 常用指令

| 指令 | 用途 |
|------|------|
| `npm run dev` | 開發伺服器(webpack) |
| `npm run build` | `prisma generate` + production build |
| `npm run start` | 跑 production build |
| `npm run lint` | ESLint |
| `npx prisma studio` | 視覺化檢視/編輯資料庫 |
| `npx prisma migrate dev` | 改完 `schema.prisma` 後建 migration |

## 程式架構地圖

```
src/
├─ app/
│  ├─ page.tsx              首頁(合約清單 / 儀表板)
│  ├─ login/                登入頁(以 SYSTEM_PASSWORD 驗證)
│  ├─ new/                  新增合約申請
│  ├─ contracts/[id]/       單一合約詳情 / 時間軸
│  ├─ reviews/  drafting/   AI 審閱 / 起草工作台
│  ├─ tools/                獨立 AI 工具頁(多公司通用)
│  ├─ admin/                後台:ai-rules / keywords / logs / notifications
│  └─ api/                  後端 route handlers(見下)
├─ components/              前端面板元件(Contract*Panel.tsx 對應各 AI 工具)
├─ lib/                     核心服務層(商業邏輯都在這)
└─ scripts/                 一次性 / 維運腳本(manual-scan、setup-sheets、tune-ai…)
```

### `src/lib/` 服務層(改邏輯先看這裡)

- `prisma.ts` — Prisma client 單例
- `ai-service.ts` / `anthropic-client.ts` / `openai-client.ts` / `gemini-client.ts` — AI 呼叫封裝
- `ai-rule-service.ts` / `keyword-service.ts` — 後台可調的 AI 規則 / 關鍵字
- `diff-service.ts` — 合約比對(方向感知:我方 / 對方風險拆分)
- `drafting-service.ts` — 合約起草(結構化欄位、防杜撰)
- `translation-service.ts` — 中英互譯
- `report-service.ts` — 合約報告 / CEO 報告
- `gcis-service.ts` — 經濟部 GCIS 公司登記查驗
- `payment-service.ts` — 付款條件檢查 / 確認
- `google-sheets.ts` / `drive-service.ts` — Google 整合
- `scanner.ts` / `scheduler.ts` — Drive 檔案掃描與排程
- `notification-service.ts` / `email.ts` — 逾期提醒、日報/週報寄送
- `logger.ts` — 寫入 Google Sheet 日誌
- `user-directory.ts` / `date-utils.ts` / `pdf-helper.ts` — 工具

### API routes(`src/app/api/`)

- **合約 CRUD**:`contracts/`、`contracts/[id]/`、`contracts/[id]/tracking/`
- **AI 工具**:`contract-diff`、`contract-draft`、`contract-name-review`、`contract-report`、`contract-translation`(+ `-cten` / `-generic`)、`architecture-review`、`extract-text`
- **外部查驗**:`gcis-verify`
- **付款**:`payment-check`、`payment-confirm`
- **後台**:`admin/ai-rules`、`admin/pending-followups`、`admin/send-followup`、`admin/sheet-diff`、`admin/sync-tracking`
- **通知**:`notification/check-overdue`、`notification/test-ceo-report`
- **排程(Cron,受 `CRON_SECRET` 保護)**:`cron/scan-files`、`cron/daily`、`cron/weekly`、`manual-scan`
- **登入**:`auth/login`

## 資料模型(`prisma/schema.prisma`)

- **`Contract`** — 合約主檔(編號如 `W250001`、需求單位、對方、文件名、付款/財務條件、狀態、優先級、各種日期、歸檔旗標)
  - `Status`:`SUBMITTED` 申請中 / `IN_REVIEW` 審閱中 / `AWAITING_FEEDBACK` 待回覆 / `PAUSED` 暫停 / `CLOSED` 結案
  - `Priority`:`NORMAL` / `URGENT`
- **`ContractTracking`** — 疊加在 Google Sheets 之上的進度層,以 `contractNumber` 對應
  - `TrackingStatus`:`REVIEWING` 審閱中 / `REPLIED` 已回覆 / `PENDING_STAMP` 待用印 / `ARCHIVED` 已歸檔

## 排程任務(`vercel.json`)

| 路徑 | 排程 | 說明 |
|------|------|------|
| `/api/cron/scan-files` | 每日 00:00 | 掃描 Google Drive 新檔 |
| `/api/cron/daily` | 每日 01:30 | 日報 / 逾期檢查 |
| `/api/cron/weekly` | 每週一 01:30 | 週報 |

> Cron endpoint 以 `CRON_SECRET` 驗證,別把它做成公開可呼叫。

## 環境變數(.env / .env.local,**不進 git**)

| 類別 | 變數 |
|------|------|
| 資料庫 | `DATABASE_URL`、`DATABASE_URL_UNPOOLED` |
| AI 金鑰 | `ANTHROPIC_API_KEY`、`OPENAI_API_KEY`、`GEMINI_API_KEY` |
| Google 服務帳號 | `GOOGLE_CLIENT_EMAIL`、`GOOGLE_PRIVATE_KEY`、`LOGGER_SPREADSHEET_ID`、`TARGET_FOLDER_ID`、`SHEET_CSV_URL` |
| 郵件 | `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`SMTP_FROM`、`CEO_EMAIL`、`NOTIFICATION_RECIPIENTS` |
| 安全 | `SYSTEM_PASSWORD`(登入密碼)、`CRON_SECRET`(cron 驗證) |

> 注意:`.env.local` 內曾有拼字錯誤的 `ARGET_FOLDER_ID`(應為 `TARGET_FOLDER_ID`),若仍存在請修正。

## 部署流程

本專案的 **GitHub repo 已連結 Vercel 專案 `legal-law`**,因此:

```bash
git add <改動的檔案>     # 不要 commit prisma/dev.db(本地 SQLite 測試檔)
git commit -m "..."
git push origin main      # ← push 到 main 會自動觸發 Vercel production 部署
```

- 不需手動跑 `vercel deploy`;push 即部署。
- 若要本地手動部署:`vercel --prod`。
- **改了環境變數**:同步到 Vercel(`vercel env add` 或在 Vercel 後台),否則 production 取不到。

## 接手注意事項 / 已知地雷

1. **GitHub 存取**:原 remote URL 內嵌了前手的 Personal Access Token,**交接後該 token 應撤銷重發**;新接手者請用自己的帳號(被加為 collaborator)。
2. **密鑰不在 repo**:clone 後務必 `vercel env pull` 或索取 `.env.local`,否則無法執行。
3. **雙資料來源**:合約資料同時在 PostgreSQL 與 Google Sheets,改動同步邏輯時兩邊都要顧(見 `admin/sync-tracking`、`admin/sheet-diff`)。
4. **`prisma/dev.db`**:本地 SQLite 測試檔,常顯示為已修改,**不要 commit**(production 用的是 PostgreSQL)。
5. **AI 成本**:多個 endpoint 會呼叫 Anthropic/OpenAI/Gemini,本地大量測試會產生 API 費用。
6. **next.config 警告**:目前有 `eslint` 設定已不被 Next 16 支援、`middleware` 建議改 `proxy` 的提示——不影響執行,可日後清理。

---
_本檔由 Claude Code 於交接時產生;若架構有變動請順手更新。_
