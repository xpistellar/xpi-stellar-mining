# XpiLock forum — nâng từ contract-claimgame.rs

File: `contracts/xpi-forum.rs`.

Giữ nguyên stake / unstake / claim / claim_game / bind_developer / pay_fee / like. Thêm lớp forum. Deploy WASM mới bằng `upgrade` (admin), không đổi storage stake cũ nếu layout `StakeInfo` giữ nguyên.

## Vì sao disk không tự thưởng

Chain không đọc được ổ đĩa. `commit_disk(user, gb)` chỉ ghi lời khai. Nếu thưởng XPi theo GB, user khai khống. Disk dùng cho:

- `can_write`: GB ≥ 100 và đã stake ≥ 31.4 XLM đủ 48 giờ
- node P2P đọc `get_disk` để xếp super-peer

Thưởng XLM vẫn chỉ qua `claim` (công thức cũ).

## Hàm mới

| Hàm | Ai ký | Việc |
|---|---|---|
| `commit_disk(user, gb)` | user | Ghi cam kết disk |
| `can_write(user)` | — | true khi đủ XLM 48h và disk ≥ 100 |
| `pay_for_topic(user, post_id)` | user | Thu 21 stroop XPi (0.0000021) vào quỹ, lưu tác giả |
| `like_post(from, post_id)` | from | Chuyển 1 stroop XPi sang tác giả |
| `set_oracle(oracle)` | admin | Node bootstrap được phép ghi view |
| `attest_views(oracle, post_id, views)` | oracle | Chỉ tăng view, không giảm |
| `claim_view_reward(creator, post_id)` | tác giả | Mỗi 1.000.000 view nhận `vrew` (mặc định 1 XPi) từ quỹ |
| `get_post` / `get_disk` | — | Đọc |

`post_id` là `BytesN<32>` (hash nội dung). Body bài nằm trên disk P2P, không nhét lên chain.

View không để user tự khai. Node stake cao gom view local rồi oracle (một key bootstrap) gọi `attest_views`. Không có oracle thì không rút được thưởng view — cố ý, vì P2P tự đếm view thì farm được.

Quỹ view lấy từ `deposit_xpi`. Hết XPi trong contract thì `claim_view_reward` fail ở lần transfer.

## Chưa đưa vào chain

- Qwen, WebRTC, thứ hạng trend: off-chain.
- Android relay: không đụng contract.
- Bonus disk trong `claim`: chưa nhân hệ số, tránh khai khống.
