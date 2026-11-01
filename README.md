# ทะเบียนคุมเลขหนังสือ โรงเรียนบ้านไร่
Cloudflare Pages + D1 (ไม่มี build step, ตารางสร้างอัตโนมัติ)

## ติดตั้ง
1. อัปโค้ดขึ้น GitHub
2. Cloudflare → Workers & Pages → Create → Pages → Connect to Git เลือก repo
   - Build command: (ว่าง)  Build output directory: `public`
3. Storage & Databases → D1 → Create database ชื่อ `banrai-docreg`
4. Pages project → Settings → Bindings → Add → D1 database → Variable name = `DB` เลือกฐานข้อมูลข้างต้น → Redeploy
5. เปิดเว็บแล้วใช้งานได้ทันที (ไปที่ "ตั้งค่า" เพื่อกรอกชื่อโรงเรียน)

## หมายเหตุ
ไม่มีระบบล็อกอิน ใครรู้ลิงก์ก็แก้ไขได้ แนะนำเปิด Cloudflare Access (ฟรี) ครอบโดเมนถ้าต้องการจำกัดผู้ใช้
