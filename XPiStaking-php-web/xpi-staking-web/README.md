# XPi Lock Staking - Web Version

Giao diện web của tool Stake / Unstake / Claim XPi.

## Đặc điểm
- Chạy hoàn toàn trên trình duyệt
- Private key **không bao giờ** gửi lên server
- Không lưu trữ bất kỳ dữ liệu nào
- **Không dùng CDN** – Stellar SDK nằm sẵn trong folder

## Cách sử dụng

1. Upload toàn bộ thư mục lên hosting PHP (hoặc bất kỳ web server nào)
2. Truy cập `index.php`
3. Nhập Private Key → chọn chức năng

## Cấu trúc
```
xpi-staking-web/
├── index.php                  ← trang chính
├── lib/
│   └── stellar-sdk.min.js     ← SDK đầy đủ (local)
├── css/
│   └── style.css
├── js/
│   └── app.js                 ← logic Stellar
└── README.md
```

## Lưu ý
- Không cần CDN bên ngoài
- Vẫn cần Internet để gọi Horizon + Soroban RPC
- Chỉ dùng trên máy tin cậy (vì phải nhập private key)
