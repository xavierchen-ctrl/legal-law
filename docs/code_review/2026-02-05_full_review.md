# 代碼審查報告 (Code Review Report)

**日期**: 2026-02-05  
**審查範圍**: `legal_flow` 專案全面審查  
**審查者**: AI Reviewer Agent  

---

## 專案概覽

Legal Flow 是一個基於 **Next.js 16 + Prisma + Google Sheets API** 的法務合約追蹤系統，主要功能包括：
- 合約狀態追蹤 (同步自 Google Sheets)
- 逾期通知 (Daily/Weekly 排程)
- Google Drive 文件掃描與 AI 關鍵字分析
- 郵件通知服務

---

## 🛡️ 安全性檢查 (Security Check)

### ❌ 高風險問題

| 檔案 | 行號 | 問題描述 | 風險等級 |
|------|------|---------|---------|
| [route.ts](file:///Users/caesarliu/gemini/legal_flow/src/app/api/auth/login/route.ts#L8) | 8 | **預設密碼暴露**: `const systemPassword = process.env.SYSTEM_PASSWORD \|\| 'admin123'` 存在不安全的 fallback 密碼 | 🔴 HIGH |
| [logger.ts](file:///Users/caesarliu/gemini/legal_flow/src/lib/logger.ts#L5) | 5 | **硬編碼 Spreadsheet ID**: `const SPREADSHEET_ID = '1S8CG7...'` 敏感 ID 未使用環境變數 | 🟠 MEDIUM |

### ✅ 安全性優點

| 項目 | 說明 |
|-----|------|
| Cron API 保護 | `cron/daily` 及 `cron/weekly` 正確使用 `CRON_SECRET` Bearer Token 驗證 |
| Cookie 安全設定 | `auth_token` Cookie 設定 `httpOnly: true` 及生產環境 `secure: true` |
| 中介層認證 | `middleware.ts` 正確阻擋未授權訪問受保護路由 |

### 建議修正

```diff
// src/app/api/auth/login/route.ts (Line 8)
- const systemPassword = process.env.SYSTEM_PASSWORD || 'admin123';
+ const systemPassword = process.env.SYSTEM_PASSWORD;
+ if (!systemPassword) {
+     return NextResponse.json({ error: '系統設定錯誤' }, { status: 500 });
+ }
```

```diff
// src/lib/logger.ts (Line 5)
- const SPREADSHEET_ID = '1S8CG7PyILAGK57Y7zNzwf4B9_XX4kGmzeBH84bUjhwE';
+ const SPREADSHEET_ID = process.env.LOGGER_SPREADSHEET_ID;
```

---

## 📖 可讀性與維護性

### ⚠️ 建議改善

| 檔案 | 問題 | 建議 |
|------|------|------|
| [page.tsx](file:///Users/caesarliu/gemini/legal_flow/src/app/page.tsx#L46-L51) + [notification-service.ts](file:///Users/caesarliu/gemini/legal_flow/src/lib/notification-service.ts#L38-L43) | **重複的 Legacy Filter 邏輯**: 相同的合約編號解析與 `legacyCutoff` 判斷出現在多處 | 提取至共用函數，例如 `isLegacyContract(contractNumber)` |
| [ai-service.ts](file:///Users/caesarliu/gemini/legal_flow/src/lib/ai-service.ts#L57) | **變數遮蔽**: 第 57 行使用 `apiKey` 但應使用 `effectiveKey` | 統一使用已驗證的 `effectiveKey` |

### ✅ 優點

- **命名清晰**: 大部分函數如 `fetchContractsFromSheet()`、`checkAndSendOverdueNotifications()` 命名直觀
- **型別安全**: 使用 TypeScript interface 定義 `SheetContract`、`EnrichedContract` 等資料結構
- **適當註解**: 重要邏輯區塊含有中文註解說明

---

## 🏗️ 架構與最佳實踐

### ⚠️ 需注意事項

| 項目 | 檔案 | 說明 |
|------|------|------|
| **Error Handling** | [google-sheets.ts](file:///Users/caesarliu/gemini/legal_flow/src/lib/google-sheets.ts#L162-L165) | catch 區塊返回空陣列並僅 `console.error`，呼叫端難以區分「無資料」與「API 失敗」 |
| **未使用程式碼** | [notification-service.ts](file:///Users/caesarliu/gemini/legal_flow/src/lib/notification-service.ts#L118-L135) | 大量註解掉的 `DISABLED` 區塊增加閱讀負擔，建議移除或提取至獨立分支 |
| **PDF 解析** | [scanner.ts](file:///Users/caesarliu/gemini/legal_flow/src/lib/scanner.ts#L7-L8) | `@ts-ignore` 標記顯示 `pdf-parse` 型別定義問題，應確認套件版本或更換穩定套件 |

### ✅ 優良實踐

- **Server Components**: `page.tsx` 使用 `async` Server Component 直接取資料，避免 Client-Side waterfall
- **分層架構**: lib/ 下服務模組化良好 (email, scanner, notification...)
- **環境變數管理**: 大部分敏感資訊正確放置於 `.env`

---

## 📝 詳細修改建議

### 1. 高優先級

| # | 類型 | 檔案 | 建議 |
|---|------|------|------|
| 1 | 🔴 Security | `auth/login/route.ts:8` | 移除 `'admin123'` fallback，強制要求設定環境變數 |
| 2 | 🟠 Security | `logger.ts:5` | 將 Spreadsheet ID 移至環境變數 |

### 2. 中優先級

| # | 類型 | 檔案 | 建議 |
|---|------|------|------|
| 3 | 🔧 DRY | `page.tsx` / `notification-service.ts` | 提取 `isLegacyContract()` 共用函數 |
| 4 | 🔧 Bug | `ai-service.ts:57` | 修正 `apiKey` → `effectiveKey` 變數使用錯誤 |
| 5 | 🧹 Cleanup | `notification-service.ts` | 移除 `DISABLED` 程式碼區塊 (`L118-L135`) |

### 3. 低優先級

| # | 類型 | 檔案 | 建議 |
|---|------|------|------|
| 6 | 📦 TypeScript | `scanner.ts:7-8` | 解決 `pdf-parse` 型別問題，移除 `@ts-ignore` |
| 7 | 🧹 Error | `google-sheets.ts` | 改善錯誤處理，區分「無資料」與「API 失敗」情境 |

---

## 🏁 結論

| 項目 | 評估 |
|------|------|
| 總體評價 | ⚠️ **建議修改後合併** |
| 主要風險 | 預設密碼暴露可能導致生產環境安全問題 |
| 程式碼品質 | 良好，架構清晰且型別安全 |

> **審查結果**: 🟡 **REQUEST CHANGES**  
> 請優先處理 **高優先級** 安全性問題後，即可安全部署。
