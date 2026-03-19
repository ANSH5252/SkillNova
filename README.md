# 🚀 SkillNova – AI-Powered ATS Simulator

SkillNova is an **AI-driven Applicant Tracking System (ATS) simulator** that helps students and job seekers understand *why their resumes get rejected* and how to improve them before applying.

Instead of applying blindly, users receive **data-driven insights, ATS scores, and actionable feedback**—just like a real hiring system.

---

## 📌 Features

### 🔍 Resume Analysis
- Upload your resume (PDF)
- AI evaluates based on real ATS standards
- Detects:
  - Missing technical skills
  - Keyword gaps
  - Formatting issues
  - Content weaknesses

### 📊 ATS Scoring
- Generates a **strict ATS score**
- Mimics real-world hiring filters
- Helps users understand their selection probability

### ✍️ AI Cover Letter Generator
- Generates **role-specific cover letters**
- Compensates for resume weaknesses
- Improves chances of shortlisting

### 🔐 Privacy-First Design
- **Client-side PDF parsing**
- No resume data is stored or uploaded
- Fully secure and user-focused

### 🏫 B2B Dashboard (For Institutions)
- Aggregated analytics of student performance
- Identifies:
  - Skill gaps across cohorts
  - Industry demand trends
- Helps universities align curriculum with job market

---

## 🧠 Tech Stack

- **Frontend:** React / Next.js  
- **Backend:** FastAPI / Node.js  
- **AI Engine:** Groq Cloud + Llama 3.1  
- **PDF Parsing:** pdf.js (client-side)  
- **Database (optional):** MongoDB / PostgreSQL  

---

## ⚙️ How It Works

1. User uploads resume (PDF)
2. Resume is parsed **on the client side**
3. Extracted content is sent to AI engine
4. AI performs:
   - Skill matching
   - Keyword analysis
   - Formatting checks
5. System generates:
   - ATS Score
   - Detailed feedback
   - Cover letter (optional)
