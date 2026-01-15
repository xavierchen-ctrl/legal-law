# 如何設定 Google 試算表存取權限

由於您的 Google 試算表設有隱私權限（非完全公開），系統需要一組「服務帳號金鑰 (Service Account Key)」才能在背景讀取內容並發送通知。

請依照以下步驟操作，即使沒有技術背景也能完成：

## 步驟 1：建立服務帳號 (Service Account)
1. 前往 [Google Cloud Console](https://console.cloud.google.com/)。
2. 建立一個新專案 (或是選用既有專案)，例如命名為 `Legal Tracker`。
3. 在左側選單搜尋並進入 **「IAM 與管理」** > **「服務帳號」**。
4. 點擊上方 **「+ 建立服務帳號」**。
   - 名稱：`sheets-reader` (隨意即可)
   - 權限：不需特別設定，按「完成」即可。
5. 在列表點擊剛剛建立的帳號 (Email 格式類似 `sheets-reader@project-id.iam.gserviceaccount.com`)。
6.進入 **「金鑰」** 頁籤 > **「新增金鑰」** > **「建立新的金鑰」** > 選擇 **JSON**。
7. **下載該 JSON 檔案**，並將其重新命名為 `credentials.json`。

## 步驟 2：啟用 API
1. 在 Google Cloud Console 上方搜尋 **"Google Sheets API"** 並點擊啟用。

### 3. Google Sheet Setup
*   Ensure your Google Sheet is published to the web (File > Share > Publish to web > CSV).
*   Add the CSV URL to `.env` as `SHEET_CSV_URL`.

## 4. Email Notification Setup

The system sends automated emails for:
1.  **Review Overdue**: Daily check for contracts pending legal review too long.
2.  **Post-Review Unclosed**: Daily check for contracts replied by Legal >14 days ago but not Closed.
3.  **CEO Weekly Report**: Weekly (Monday) summary of all unclosed CEO Office contracts.

### Configuration (`.env`)

You can control the sender and recipients using these Environment Variables:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| **`SMTP_HOST`** | SMTP Server Host | `smtp.gmail.com` |
| **`SMTP_USER`** | SMTP Account | `your_email@gmail.com` |
| **`SMTP_PASS`** | SMTP App Password | `xxxx-xxxx-xxxx-xxxx` |
| **`SMTP_FROM`** | **(Sender)** The name/email shown | `"Legal System" <noreply@corp.com>` |
| **`CEO_EMAIL`** | **(Main Recipient)** Receives all alerts | `ceo@example.com` |
| **`NOTIFICATION_RECIPIENTS`** | **(CC List)** Additional recipients | `manager@corp.com, legal@corp.com` |

> **Note**: `NOTIFICATION_RECIPIENTS` supports multiple emails separated by commas (`,`).

### Scheduler
The system uses a built-in scheduler (Cron) that starts automatically with the server.
*   **Daily Check**: Every day at **09:30 AM**.
*   **Weekly Report**: Every Monday at **09:30 AM**.

## 步驟 3：共用試算表權限 (關鍵！)
1. 打開您的 `credentials.json` 檔案，複製裡面的 `client_email` (那串長長的 Email)。
2. 回到您的 **Google 試算表**。
3. 點擊右上角 **「共用」**。
4. 將 `client_email` 貼上，權限設為 **「檢視者」** 即可。
5. 點擊 **「傳送」**。

## 步驟 4：將金鑰放入專案
1. 請將 `credentials.json` 檔案放入專案資料夾：
   `/Users/caesarliu/gemini/legal_flow/credentials.json`

完成後，請通知我，我將調整程式碼以讀取這張表單。
