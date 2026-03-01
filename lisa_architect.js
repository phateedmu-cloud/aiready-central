// lisa_architect.js - เวอร์ชันดึงกุญแจจากไฟล์ .env (ปลอดภัย 100%)
require('dotenv').config(); // โหลดข้อมูลจากไฟล์ .env
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { exec } = require('child_process');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

// ==========================================
// 🔑 ดึง API KEY จากไฟล์ .env (ปลอดภัย ไม่หลุดไปบน GitHub)
const API_KEY = process.env.API_KEY; 
// ==========================================

if (!API_KEY) {
  console.error("❌ Error: ไม่พบ API KEY ในระบบค่ะ กรุณาตรวจสอบไฟล์ .env นะคะ");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("------------------------------------------------------");
console.log("👩‍💻 Lisa Architect: ระบบพร้อมทำงานแล้วค่ะ (Secure Env Mode)");
console.log("------------------------------------------------------");

const chatLoop = () => {
  rl.question('💬 คุณเอก: ', async (userInput) => {
    
    if (userInput.toLowerCase() === 'exit') {
      console.log("👋 บ๊ายบายค่ะ!");
      rl.close();
      return;
    }

    console.log("Thinking... 🧠");

    const prompt = `
      คุณคือ "Lisa" AI Developer ผู้ช่วยของคุณเอก
      
      🚨 กฎสำคัญเรื่อง Path:
      โปรเจกต์ Next.js ของเราอยู่ในโฟลเดอร์ย่อยชื่อ "the-old-phuket"
      ดังนั้น field "filepath" ใน JSON ต้องขึ้นต้นด้วย "the-old-phuket/" เสมอ!
      (ตัวอย่าง: "the-old-phuket/app/page.js")

      User Request: "${userInput}"
      
      คำสั่ง: จงตอบกลับเป็น JSON เท่านั้น (ห้ามมีคำอธิบายอื่น ห้ามใส่ markdown):
      {
        "action": "WRITE_FILE" หรือ "RUN_SCRIPT" หรือ "CHAT",
        "filepath": "path ของไฟล์",
        "content": "เนื้อหา Code ทั้งหมด",
        "command": "คำสั่งที่จะรัน",
        "reply": "คำตอบสั้นๆ"
      }
    `;

    try {
      const result = await model.generateContent(prompt);
      // ลบสัญลักษณ์ที่อาจจะติดมา
      const responseText = result.response.text().replace(/```json|```/g, '').trim();
      
      let aiDecision;
      try {
        aiDecision = JSON.parse(responseText);
      } catch (e) {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            aiDecision = JSON.parse(jsonMatch[0]);
        } else {
            console.log("❌ JSON Error:", responseText);
            chatLoop();
            return;
        }
      }

      console.log(`👩‍💻 Lisa: ${aiDecision.reply}`);

      if (aiDecision.action === "WRITE_FILE") {
        console.log(`📝 กำลังเขียนไฟล์ไปที่: ${aiDecision.filepath}...`);
        
        const dir = path.dirname(aiDecision.filepath);
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(aiDecision.filepath, aiDecision.content);
        console.log("✅ บันทึกเสร็จเรียบร้อย! (หน้าเว็บอัปเดตแล้ว)");
      }

      else if (aiDecision.action === "RUN_SCRIPT") {
        exec(aiDecision.command, (error, stdout, stderr) => {
          if (error) console.error(`Error: ${error.message}`);
          if (stdout) console.log(`\n${stdout}`);
          chatLoop();
        });
        return; 
      }

    } catch (error) {
      console.error("❌ Error:", error.message);
    }

    chatLoop();
  });
};

chatLoop();