# XPi Staking - Android App

Ứng dụng Android để **Stake / Claim XPi** trên Stellar Mainnet.

## Tính năng

- Đăng nhập bằng Private Key (S...)
- Hiển thị số dư XLM realtime (từ Horizon)
- Stake XLM (tối thiểu **3 XLM**)
- Claim thưởng XPi
- Xem thông tin stake
- UI dark mode hiện đại, card, loading đẹp

## Thông tin Contract

| Thông số        | Giá trị                                              |
|-----------------|------------------------------------------------------|
| Contract ID     | `CD66QJYVCY3IXDUJVP55QAILUQQJCQPEL6SUWTNDCPMPLTA4YB6SKBDG` |
| Network         | Mainnet                                              |
| Minimum Stake   | 3 XLM                                                |
| App Version     | 1.0.0                                                |
| applicationId   | com.xpi.staking                                      |

## Yêu cầu build trên Ubuntu

- Ubuntu 20.04 / 22.04 / 24.04
- JDK 17
- Android command-line tools + SDK (API 35)

## Lưu ý bảo mật

- Private key **chỉ lưu trong RAM**, không ghi file / SharedPreferences.
- Không chia sẻ private key với bất kỳ ai.
- Nên dùng ví phụ có số dư nhỏ để test.
