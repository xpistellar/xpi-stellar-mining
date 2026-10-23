---
layout: default
title: Manual
---

# Hướng dẫn Stake XPi

Stake XLM trên mạng Stellar để nhận XPi thông qua hợp đồng Soroban.

* **Contract ID**: `CDQ4OO3FU3CBNVWZX2GDU4BQQNQFAHBITTXULTVIECY4OMJGTM33M73H`
* **Mức stake tối thiểu**: 31,4 XLM
* **Thưởng ước tính**: ~0,0000003 XPi/ngày cho mỗi 31,4 XLM (tỷ lệ gần như tuyến tính)
* Người dùng tự giữ private key

---

## 1. Node.js CLI Tool (Ubuntu)

Công cụ dòng lệnh đơn giản để stake, unstake, claim thưởng và kiểm tra số dư.

### Yêu cầu

* Ubuntu 20.04 trở lên
* Kết nối Internet

### Bước 1: Cài Node.js

```bash
sudo apt update
sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### Bước 2: Tạo thư mục dự án

```bash
mkdir ~/xpi-staking
cd ~/xpi-staking
```

Tải hoặc tạo file `stake-claim.js` và dán script Node.js staking vào đó.

### Bước 3: Cài dependencies

```bash
npm init -y
npm install @stellar/stellar-sdk
```

### Bước 4: Chạy công cụ

```bash
node stake-claim.js
```

Bạn sẽ được hỏi secret key Stellar (bắt đầu bằng `S...`).

**Menu:**

1. Stake XLM (tối thiểu 31,4)
2. Unstake XLM (Enter hoặc 0 để unstake hết)
3. Claim XPi rewards
4. Xem stake hiện tại
5. Xem thưởng đang chờ
6. Thoát

### Lưu ý quan trọng

* **Không bao giờ chia sẻ secret key**.
* Đảm bảo tài khoản có đủ XLM cho stake + phí mạng.
* Có thể unstake bất cứ lúc nào.

---

## 2. Android App – Cài trực tiếp (APK)

### Yêu cầu

* Android 8.0 trở lên
* Cho phép cài từ nguồn không xác định

### Cài đặt

1. Tải file APK từ nguồn chính thức của dự án
2. Mở file APK và cho phép cài đặt
3. Mở app → kết nối ví Stellar (hoặc nhập secret key nếu app hỗ trợ)
4. Thêm trustline XPi nếu chưa có
5. Stake XLM và claim thưởng theo hướng dẫn trong app

---

## 3. Sử dụng ví Stellar thông thường

Bạn cũng có thể tương tác với hợp đồng thông qua các ví hỗ trợ Soroban (ví dụ Freighter, Lobstr, xBull…) khi đã hiểu rõ cách gọi contract.

**Luôn kiểm tra Contract ID và Issuer trước khi thực hiện bất kỳ giao dịch nào.**

---

[← Về trang chủ](index.html)
