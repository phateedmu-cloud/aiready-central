// hunter_bot.js - บอทนักล่าข้อมูล
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const puppeteer = require('puppeteer');
const fs = require('fs');

// ตั้งค่าสมอง (Lisa)
// *** สังเกตบรรทัดนี้: เราใช้ Key ใหม่ที่เพิ่งสมัครมาใส่ตรงๆ เลยเพื่อความชัวร์ ***
const genAI = new GoogleGenerativeAI("AIzaSyAEr_Woq2Dnn5KfTHNQNEA6yoGkrbjG0mc");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// 🎯 ใส่ลิงก์โรงแรมที่อยากไปล่าข้อมูล ตรงนี้ครับ! (เปลี่ยนได้เรื่อยๆ)
const TARGET_URL = "https://www.theoldphuket.com/"; 

async function startHunting() {
  console.log("🤖 Mousebot: กำลังออกปฏิบัติการ...");
  console.log(`🎯 เป้าหมาย: ${TARGET_URL}`);

  // 1. เปิดเบราว์เซอร์ (แขนขาทำงาน)
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  // ปลอมตัวเป็นคน (ไม่ให้เว็บรู้ว่าเป็นบอท)
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');
  
  // ไปที่เว็บ
  await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });

  // ดึงข้อความทั้งหมดในเว็บมา
  const pageContent = await page.evaluate(() => document.body.innerText);
  console.log("✅ Mousebot: ดึงข้อมูลดิบมาได้แล้ว! (ส่งต่อให้พี่ลิซ่าวิเคราะห์...)");

  // 2. ส่งให้ลิซ่าวิเคราะห์ (สมองทำงาน)
  const prompt = `
    ฉันคือบอทที่ไปดึงข้อความมาจากหน้าเว็บโรงแรม นี่คือข้อมูลดิบ:
    ---
    ${pageContent.substring(0, 10000)} 
    ---
    
    ช่วยสกัดข้อมูลสำคัญออกมาเป็น JSON ให้หน่อย โดยมีหัวข้อดังนี้:
    1. hotelName (ชื่อโรงแรม ภาษาอังกฤษ)
    2. description (คำบรรยายสั้นๆ ให้น่าสนใจ ภาษาไทย)
    3. amenities (รายการสิ่งอำนวยความสะดวก เป็น Array)
    4. contact (เบอร์โทร หรือ อีเมล ถ้าหาเจอ)
    
    ตอบกลับมาเป็น JSON เท่านั้น ไม่ต้องมีคำเกริ่น
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const jsonText = response.text().replace(/```json|```/g, '').trim(); // ล้าง format ให้สะอาด

  // 3. บันทึกผลลัพธ์
  fs.writeFileSync('hotel_data.json', jsonText);
  console.log("🎉 เสร็จภารกิจ! ข้อมูลถูกเซฟลงไฟล์ 'hotel_data.json' เรียบร้อยครับ");
  console.log("-------------------------------------");
  console.log(jsonText);

  await browser.close();
}

startHunting();