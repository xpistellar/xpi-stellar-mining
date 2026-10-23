---
layout: default
title: "XPi Whitepaper – Sách trắng"
date: 2025-07-18
---

# XPi: Một Hệ Thống Tiền Điện Tử Ngang Hàng Dựa Trên Stellar

**Sách trắng**

### Tóm tắt

Một phiên bản tiền điện tử ngang hàng hoàn toàn sẽ cho phép thanh toán trực tuyến được gửi trực tiếp từ bên này sang bên kia mà không cần đi qua một tổ chức tài chính. Chữ ký số cung cấp một phần của giải pháp, nhưng những lợi ích chính sẽ bị mất nếu vẫn cần một bên thứ ba đáng tin cậy để ngăn chặn chi tiêu kép.

Chúng tôi đề xuất một giải pháp cho vấn đề chi tiêu kép bằng cách sử dụng mạng Stellar đã được chứng minh, kết hợp với hợp đồng thông minh Soroban để phân phối một tài sản khan hiếm có tổng cung cố định.

- **Tổng cung XPi**: khoảng 63 triệu đơn vị  
- **Nhóm điều hành giữ**: dưới 15% (bảo vệ mạng, tương tự các địa chỉ sớm của Bitcoin)  
- **Phân phối**: 21 XPi mỗi ngày qua staking XLM  
- **Thời gian phân phối phần cộng đồng**: khoảng 6.986 năm  

Hệ thống kế thừa Stellar Consensus Protocol, DEX tích hợp sẵn, phí cực thấp và khả năng vận hành nút trên phần cứng thông thường, tạo ra một tài sản vừa đủ khan hiếm để lưu trữ giá trị lâu dài, vừa đủ đơn giản để bất kỳ ai cũng có thể sở hữu thông qua private key mà mình kiểm soát.

### 1. Giới thiệu

Thương mại trên Internet đã phụ thuộc gần như hoàn toàn vào các tổ chức tài chính đóng vai trò bên thứ ba đáng tin cậy. Hệ thống này chịu những điểm yếu vốn có của mô hình dựa trên niềm tin: chi phí hòa giải cao, giới hạn quy mô giao dịch nhỏ, và nhu cầu tin cậy cao hơn.

Điều cần thiết là một hệ thống thanh toán điện tử dựa trên bằng chứng mật mã thay vì niềm tin. XPi được thiết kế để kết hợp tổng cung cố định với cơ chế phân phối cực chậm và khả năng tiếp cận thông qua staking một lượng XLM khiêm tốn trên mạng Stellar đã hoàn thiện.

### 2. Nguyên tắc tiền tệ

Ba chức năng cơ bản của tiền: phương tiện trao đổi, đơn vị tính toán và lưu trữ giá trị. Tiền pháp định dễ bị mất sức mua do khả năng in thêm không giới hạn. Vàng từng đóng vai trò lưu trữ giá trị nhờ tính khan hiếm tự nhiên. Bitcoin chứng minh sự khan hiếm kỹ thuật số là khả thi, nhưng Proof-of-Work tạo rào cản cao cho người bình thường.

XPi kết hợp:
- Tổng cung cố định
- Phân phối cực chậm
- Quyền sở hữu thực sự qua private key
- Khả năng tiếp cận cao qua staking XLM

### 3. Giao dịch và quyền sở hữu

Mỗi XPi là một chuỗi chữ ký số. Người dùng giữ private key và kiểm soát hoàn toàn số dư của mình trên sổ cái Stellar. Không có server trung tâm lưu trữ số dư.

### 4. Cơ chế phân phối

- 21 XPi được phát mỗi ngày
- Phân phối thông qua hợp đồng Soroban dựa trên số XLM stake
- Phần thưởng tỷ lệ gần như tuyến tính với số XLM khóa
- Unstake bất cứ lúc nào, XLM được trả lại

### 5. Kết luận

XPi nhằm tạo ra một tài sản số vừa đủ khan hiếm để có tiềm năng lưu trữ giá trị dài hạn, vừa đủ dễ tiếp cận để hàng trăm triệu người có thể sở hữu trực tiếp.

---

[← Về trang chủ]({{ site.baseurl }}/)
