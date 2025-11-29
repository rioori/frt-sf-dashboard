# FRT × Samsung Finance+ Dashboard

Interactive store performance dashboard with **realtime Supabase sync**.

![Dashboard Preview](https://via.placeholder.com/800x400?text=FRT+SF%2B+Dashboard)

## ✨ Features

- 📊 **Realtime Data** - Fetches directly from Supabase
- 🔄 **Auto-refresh** - Updates every 5 minutes automatically
- 🔘 **Manual Refresh** - Click button to update anytime
- 📱 **Responsive** - Works on desktop & mobile
- 🔍 **Search & Sort** - Find stores quickly
- 📈 **Trend Indicators** - Visual up/down trends

---

## 🚀 Deploy to Vercel (Recommended)

### Step 1: Push to GitHub

```bash
# 1. Create new repo on GitHub: https://github.com/new
# Name it: frt-sf-dashboard

# 2. Initialize and push
cd frt-dashboard-supabase
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/frt-sf-dashboard.git
git push -u origin main
```

### Step 2: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"**
3. Import your `frt-sf-dashboard` repository
4. **Configure Environment Variables:**
   - Click "Environment Variables"
   - Add:
     ```
     VITE_SUPABASE_URL = https://xwgnwyqdojljjfglbytw.supabase.co
     VITE_SUPABASE_ANON_KEY = [your_anon_key]
     ```
5. Click **"Deploy"**
6. Wait 1-2 minutes, done! 🎉

Your dashboard will be live at: `https://frt-sf-dashboard.vercel.app`

---

## 🔑 Get Supabase Anon Key

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/xwgnwyqdojljjfglbytw/settings/api)
2. Find **"Project API keys"**
3. Copy the **"anon public"** key

> ⚠️ The anon key is safe to use in frontend because Row Level Security (RLS) protects your data.

---

## 💻 Run Locally (Optional)

```bash
# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env
# Edit .env and add your VITE_SUPABASE_ANON_KEY

# 3. Start development server
npm run dev

# 4. Open browser
# http://localhost:5173
```

---

## 📁 Project Structure

```
frt-dashboard-supabase/
├── src/
│   ├── App.jsx          # Main dashboard component
│   ├── main.jsx         # Entry point
│   └── index.css        # Tailwind styles
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.example
├── .gitignore
└── README.md
```

---

## ⚙️ Configuration

Edit `CONFIG` object in `src/App.jsx` to customize:

```javascript
const CONFIG = {
  MERCHANT_NAME: "FRT",           // Header title
  MERCHANT_FULL_NAME: "FPT Retail", // Subtitle
  TABLE_NAME: "KVVN_SF_FRT_Store_Level", // Supabase table
  AUTO_REFRESH_INTERVAL: 5 * 60 * 1000,  // 5 minutes
  THRESHOLDS: {
    approval: [60, 50],      // Green > 60%, Yellow > 50%
    conversion: [40, 30],    // Green > 40%, Yellow > 30%
    storePenetration: [70, 50]
  }
};
```

---

## 🔄 Creating Dashboard for Other Merchants

1. Copy this project
2. Update `CONFIG` in `App.jsx`:
   - Change `MERCHANT_NAME` (e.g., "MWG", "CPS")
   - Change `TABLE_NAME` (e.g., "KVVN_SF_MWG_Store_Level")
3. Deploy to Vercel with a new project name

---

## 📊 Required Supabase Table Structure

Your table should have these columns:

| Column | Type | Description |
|--------|------|-------------|
| `application_month` | date | First day of month (2025-01-01) |
| `dealer_code` | text | Unique store ID |
| `submerchant` | text | Store name |
| `net_incoming` | integer | SF+ applications |
| `approved` | integer | Approved applications |
| `trx_settled` | integer | Successful transactions |
| `gmv` | numeric | Gross Merchandise Value |

---

## 🛠️ Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Supabase** - Database
- **Lucide React** - Icons
- **Vercel** - Hosting

---

## 📝 License

MIT - Free to use and modify.

---

## 🤝 Support

For questions or issues, contact: Khang Pham (BizDev Team Lead, Kredivo Vietnam)
