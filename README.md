<div align="center">

# 🛠️ GazaServe

### A Smart Platform Connecting Gaza Residents with Home Maintenance Technicians via Telegram

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.1-000000?logo=express)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)
![Telegraf](https://img.shields.io/badge/Telegraf-4.16-2CA5E0?logo=telegram&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o%20%7C%20Whisper-412991?logo=openai&logoColor=white)
![Sequelize](https://img.shields.io/badge/Sequelize-6.37-52B0E7?logo=sequelize)
![Railway](https://img.shields.io/badge/Deploy-Railway-0B0D0E?logo=railway)

</div>

---

## 📖 Overview

**GazaServe** is a smart service platform that runs entirely inside the **Telegram** application, designed to solve the problem of finding a reliable home maintenance technician in the Gaza Strip.

The platform allows Gaza residents to submit home maintenance requests (electrical, plumbing, cleaning, solar energy, restoration & construction, aluminum & blacksmithing, furniture transport & installation) with ease, offering:

- 🤖 **AI-powered request categorization** (text or voice)
- 🪪 **Automatic technician identity verification** using AI before approval
- 📍 **Precise matching** between technicians and requests by specialty and region
- 🔄 **Complete request lifecycle** (pending → search expansion → expiry)
- 📞 **Integrated support system** with admin notifications

---

## ✨ Key Features

### 🧑‍💼 For Clients
| Feature | Description |
|---------|-------------|
| 📝 Submit maintenance request | Describe the problem in text or voice, optionally attach a photo |
| 🧠 Automatic categorization | AI detects the service type from the description automatically |
| 🗺️ Location selection | Choose governorate + sub-region + detailed address |
| 📅 Appointment scheduling | Pick the preferred date and time |
| 📋 Request tracking | Real-time status (pending / accepted / on the way / in progress / completed) |
| 🗑️ Cancel request | Cancel requests still pending |
| 📦 Request archive | Review completed and archived requests |
| 🎧 Support center | Open a support ticket and communicate with the admin |

### 👨‍🔧 For Technicians
| Feature | Description |
|---------|-------------|
| 📝 7-step registration wizard | Full name, national ID, phone, specialty, region, experience, ID photo |
| 🪪 Automatic ID verification | GPT-4o reads the ID photo and matches name & ID number |
| 🔔 Request notifications | Receive matching requests by specialty and region instantly |
| ✅ Instant acceptance | Atomic acceptance system prevents double-acceptance |
| 📌 Task management | Update request status: on the way → in progress → completed |
| 🚫 Unsubscribe | Remove registration at any time |

### 🛡️ For Admins
| Feature | Description |
|---------|-------------|
| ✅ Technician approval | Accept or reject technician registrations with instant notifications |
| ✉️ Support ticket replies | Reply to and close user tickets |
| 📊 Registration notifications | Receive details of every new technician |

---

## 🧠 AI in the Platform

| Function | Model | Usage |
|----------|-------|-------|
| Maintenance request classification | `gpt-3.5-turbo` | Extract service type from user description (Function Calling) |
| General assistant chat | `gpt-3.5-turbo` | Respond to general user inquiries |
| Speech-to-text | `whisper-1` | Transcribe voice messages, then classify them |
| Identity verification | `gpt-4o` (Vision) | Read ID number & name from the card photo and match them |

### Identity Verification Pipeline (OCR)
1. Download the ID photo from Telegram servers
2. Process the image (compress & resize via `sharp`) to reduce cost
3. Send the image to `gpt-4o` with precise reading instructions
4. Compare the extracted ID number (supporting Arabic-Indic digits `٠-٩`) with the entered one
5. Compare the extracted name with the entered name via fuzzy matching (Levenshtein + sorted-characters match)
6. Issue the decision: ✅ Accepted / ❌ Rejected / ⏳ Manual review

---

## 🏗️ Technical Architecture

```
┌────────────────────────────────────────────────────┐
│                    Telegram                        │
│        (Client / Technician / Admin)               │
└──────────────────────┬─────────────────────────────┘
                       │
              ┌────────▼────────┐
              │  Telegraf Bot   │
              └────────┬────────┘
                       │
              ┌────────▼────────┐         ┌──────────────┐
              │   Express.js    │────────►│  Webhook/API │
              └────────┬────────┘         └──────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌────────────┐ ┌────────────┐
│ OpenAI APIs  │ │  MySQL DB  │ │ Cloudinary │
│ gpt-3.5-turbo│ │ (Sequelize)│ │  Images    │
│ gpt-4o       │ └────────────┘ └────────────┘
│ whisper-1    │
└──────────────┘
```

### Request Lifecycle

```
pending ──► accepted ──► on_the_way ──► in_progress ──► completed ──► archived
   │
   │  (urgent: after 1h | normal: after 6h)  no technician found
   ▼
escalated (search expanded to neighboring regions)
   │
   │  (urgent: after 6h | normal: after 24h)
   ▼
expired (request auto-closed, client notified)
```

---

## 🛠️ Technology Stack

| Category | Technology |
|----------|------------|
| 🟢 Runtime | Node.js 18+ (CommonJS) |
| 🟢 Web Framework | Express 5.1 |
| 🟢 Telegram Bot | Telegraf 4.16 |
| 🟢 Database | MySQL 8 |
| 🟢 ORM | Sequelize 6.37 |
| 🟢 AI | OpenAI (gpt-3.5-turbo / gpt-4o / whisper-1) |
| 🟢 Image Hosting | Cloudinary |
| 🟢 Scheduling | node-cron |
| 🟢 Image Processing | sharp (optional) |
| 🟢 File Upload | Multer |
| 🟢 Security | Helmet + CORS + Express Rate Limit |
| 🟢 Deployment | Railway (PaaS) |

---

## 🚀 Local Development

### Prerequisites
- Node.js 18 or later
- MySQL 8
- [OpenAI](https://platform.openai.com) account for an API key
- [Cloudinary](https://cloudinary.com) account
- A Telegram bot from [@BotFather](https://t.me/BotFather)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/doaashafout/Gaza-Serve-test.git
cd Gaza-Serve-test

# 2. Install dependencies
npm install

# 3. Create the environment file
cp .env.example .env
```

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment | `development` |
| `PORT` | Server port | `4040` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `3306` |
| `DB_NAME` | Database name | `gazaserve` |
| `DB_USER` | Database user | `root` |
| `DB_PASSWORD` | Database password | `` |
| `DATABASE_URL` | Full connection URL (Railway) | `mysql://...` |
| `DB_SSL` | Enable SSL for the database | `true` |
| `TELEGRAM_BOT_TOKEN` | Bot token | from BotFather |
| `OPENAI_API_KEY` | OpenAI API key | from platform.openai.com |
| `ADMIN_ID` | Admin Telegram ID | `5290473529` |
| `CLOUDINARY_CLOUD_NAME` | Cloud name | `your_cloud_name` |
| `CLOUDINARY_API_KEY` | API key | `your_api_key` |
| `CLOUDINARY_API_SECRET` | API secret | `your_api_secret` |
| `SERVER_URL` | Public server URL (webhook) | `https://your-domain.com` |
| `FORCE_POLLING` | Force polling mode | `true` |

### Running

```bash
# Create the database and tables
npm run db:init

# (Optional) Seed demo data
npm run db:seed

# Run in development mode
npm run dev

# Run in production
npm start
```

---

## ☁️ Deployment on Railway

1. Create a new project from the GitHub repository
2. Add a **MySQL** database (not PostgreSQL)
3. Add the environment variables listed above
4. Set `DB_SSL=true` and `FORCE_POLLING=true`
5. Deploy — tables are created automatically (`sequelize.sync`)

> 🚀 Tables and default categories are created and seeded automatically on first run — no manual migration commands needed.

---

## 📁 Project Structure

```
├── index.js                          # Main entry point
├── src/
│   ├── bot.js                        # Bot setup and commands
│   ├── config/                       # Environment & database configuration
│   ├── controllers/                  # Business logic (Client/Request/Technician/Support)
│   ├── Models/                       # Database models (Sequelize)
│   ├── routes/                       # Webhook & REST API routes
│   ├── scenes/                       # Technician registration wizard
│   ├── services/                     # Services (OpenAI/Cloudinary/distribution/scheduling)
│   ├── middlewares/                  # State & auth middleware
│   ├── helpers/                      # Helper functions
│   ├── views/                        # Telegram UI renderers
│   ├── validations/                  # Validation functions
│   ├── Seeders/                      # Demo data
│   └── assets/                       # Images and logos
├── database/schema.sql               # Reference database schema
└── uploads/                          # Local uploaded files
```

---

## 🗄️ Database

| Table | Description |
|-------|-------------|
| `users` | Platform users (clients) |
| `technicians` | Registered technicians with approval status |
| `service_requests` | Service requests with full lifecycle |
| `support_tickets` | Support tickets |
| `categories` | Available service categories |

### Relationships
- **Client** 1 → N **Requests** (each client submits multiple requests)
- **Technician** 1 → N **Requests** (each request is assigned to one technician)
- **Client** 1 → N **Tickets** (each client opens multiple tickets)
- **Category** 1 → N **Technicians & Requests** (logical relation, no foreign key constraint)

---

## 📌 Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Main menu |
| `/help` | Usage guide |
| `/newrequest` | New service request |
| `/myorders` | My current requests |
| `/register` | Register as technician |
| `/tasks` | My tasks (technician) |
| `/support` | Contact support |
| `/archive` | Archived requests |
| `/deregister` | Unsubscribe as technician |
| `/about` | About the platform |
| `/myid` | Show my Telegram ID |

---

## 👥 Team

Graduation project submitted in partial fulfillment of the requirements for a Bachelor's degree.

---

## 📄 License

All rights reserved © GazaServe
