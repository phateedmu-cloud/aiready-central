const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const prisma = new PrismaClient();
const PORT = 5000;

// 🔑 API KEY
const API_KEY = process.env.API_KEY || "AIzaSyAEr_Woq2Dnn5KfTHNQNEA6yoGkrbjG0mc"; 
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); 

app.use(cors());
app.use(express.json());
app.use(express.static('public')); 

let chatHistory = []; 
let leadData = { hotelName: null, contactName: null, phone: null };
let isSaved = false;

app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        // 🌐 รับรหัสภาษาที่หน้าเว็บกระซิบบอกมา (ถ้าไม่มีให้ถือว่าเป็น th)
        const userLang = req.body.language || "th"; 

        chatHistory.push({ role: "user", parts: [{ text: userMessage }] });

        // 📝 อัปเดต Prompt เพิ่ม "กฎเหล็กเรื่องภาษา" เข้าไป
        const prompt = `
        คุณคือ "Lisa" ผู้ช่วย AI ของโครงการ "AI-Ready Hotel" 
        หน้าที่ของคุณคือให้ข้อมูลโครงการ และค่อยๆ เก็บข้อมูลลูกค้าให้ครบ 3 อย่าง
        
        สถานะข้อมูลที่เก็บได้ตอนนี้:
        1. ชื่อโรงแรม: ${leadData.hotelName || "ยังไม่ทราบ"}
        2. ชื่อผู้ติดต่อ: ${leadData.contactName || "ยังไม่ทราบ"}
        3. เบอร์โทรศัพท์: ${leadData.phone || "ยังไม่ทราบ"}

        🚨 กฎสำคัญเรื่องภาษา (STRICT LANGUAGE RULE):
        - ลูกค้าคนนี้กำลังใช้งานเว็บไซต์ในภาษารหัส: "${userLang}"
        - ถ้าภาษาคือ "en" ให้คุณแปลความคิดและตอบกลับเป็น "ภาษาอังกฤษ (English)" ทั้งหมด
        - ถ้าภาษาคือ "it" ให้คุณแปลความคิดและตอบกลับเป็น "ภาษาอิตาลี (Italian)" ทั้งหมด
        - ถ้าภาษาคือ "th" ให้ตอบเป็น "ภาษาไทย"
        - ไม่ว่าข้อมูลโครงการของคุณจะเป็นภาษาอะไร คำตอบในส่วน "reply" ต้องถูกแปลเป็นภาษา "${userLang}" อย่างสละสลวย เป็นธรรมชาติ และสุภาพเสมอ!

        กฎการคุย:
        - ชวนคุยและตอบคำถามอย่างเป็นมิตร
        - ถ้าข้อมูลยังไม่ครบ ให้ถามข้อมูลที่เหลือทีละ 1 อย่าง ห้ามถามรวดเดียว
        - ถ้าได้ข้อมูลครบ 3 อย่างแล้ว ให้ขอบคุณลูกค้าและแจ้งว่าจะให้ทีมงานติดต่อกลับ (แปลประโยคนี้เป็นภาษา ${userLang} ด้วย)
        
        กฎการตอบ (ตอบเป็น JSON เท่านั้น):
        {
            "reply": "คำตอบของคุณ (ต้องเป็นภาษา ${userLang} เท่านั้น)",
            "extracted": {
                "hotelName": "ใส่ชื่อโรงแรมถ้าลูกค้าเพิ่งบอก (ถ้าไม่มีใส่ null)",
                "contactName": "ใส่ชื่อผู้ติดต่อถ้าลูกค้าเพิ่งบอก (ถ้าไม่มีใส่ null)",
                "phone": "ใส่เบอร์โทรถ้าลูกค้าเพิ่งบอก (ถ้าไม่มีใส่ null)"
            }
        }

        ประวัติการสนทนา:
        ${JSON.stringify(chatHistory)}

        ลูกค้าพิมพ์มาว่า: "${userMessage}"
        `;

        const result = await model.generateContent(prompt);
        let aiText = result.response.text().replace(/```json|```/g, '').trim();
        const aiData = JSON.parse(aiText);

        // 3. อัปเดตข้อมูลลูกค้าลงในสมอง (เพิ่มตัวกรอง ป้องกัน AI ส่งคำว่า "null" กลับมา)
        const checkValidData = (text) => {
            if (!text) return null;
            if (typeof text === 'string' && text.toLowerCase() === 'null') return null;
            if (typeof text === 'string' && text === 'ไม่ระบุ') return null;
            return text;
        };

        const newHotel = checkValidData(aiData.extracted.hotelName);
        if (newHotel) leadData.hotelName = newHotel;

        const newContact = checkValidData(aiData.extracted.contactName);
        if (newContact) leadData.contactName = newContact;

        const newPhone = checkValidData(aiData.extracted.phone);
        if (newPhone) leadData.phone = newPhone;

        // 4. บันทึกคำตอบของลิซ่าลงความจำ
        chatHistory.push({ role: "model", parts: [{ text: aiData.reply }] });

        if (leadData.hotelName && leadData.contactName && leadData.phone && !isSaved) {
            await prisma.lead.create({
                data: {
                    hotelName: leadData.hotelName,
                    contactName: leadData.contactName,
                    contactDetail: leadData.phone,
                    status: "NEW"
                }
            });
            console.log(`🎯 [SUCCESS] ได้ Lead ใหม่! (คุยผ่านภาษา ${userLang})`);
            isSaved = true; 
        }

        res.json({ reply: aiData.reply });

    } catch (error) {
        console.error("❌ AI Error:", error);
        res.status(500).json({ reply: "System Error. Please try again." });
    }
});

app.get('/api/reset', (req, res) => {
    chatHistory = [];
    leadData = { hotelName: null, contactName: null, phone: null };
    isSaved = false;
    res.json({ message: "ล้างความจำเรียบร้อย!" });
});

app.get('/api/leads', async (req, res) => {
    try {
        const leads = await prisma.lead.findMany({
            orderBy: { createdAt: 'desc' } 
        });
        res.json(leads);
    } catch (error) {
        res.status(500).json({ error: "Error fetching data" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server และ สมองของลิซ่า พร้อมทำงานที่ http://localhost:${PORT}`);
});