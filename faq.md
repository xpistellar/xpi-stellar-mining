---
layout: default
title: FAQ
---

# 50 Câu Hỏi Thường Gặp về XPi

### Cơ bản về XPi

**1. XPi là gì?**  
XPi là token chạy trên mạng Stellar. Tổng cung khoảng 63 triệu, được phân phối rất chậm qua việc stake XLM.

**2. XPi dùng để làm gì?**  
Chủ yếu để tích lũy dài hạn. Dự án thiết kế để mọi người có thể sở hữu một tài sản khan hiếm mà không cần máy đào đắt tiền.

**3. Ai tạo ra XPi?**  
Nhóm phát triển tạo trên mạng Stellar và hợp đồng Soroban. Không phải cá nhân ẩn danh.

**4. XPi có phải tiền pháp định không?**  
Không. Nó là tài sản số trên Stellar, giá trị do thị trường và người dùng quyết định.

**5. XPi khác Bitcoin thế nào?**  
Bitcoin khó đào với người bình thường. XPi cho phép stake XLM là nhận được, ai cũng tham gia được.

### Tổng cung và phân phối

**6. Tổng cung XPi là bao nhiêu?**  
Khoảng 63 triệu XPi.

**7. Nhóm điều hành giữ bao nhiêu?**  
Dưới 15% (khoảng 9,45 triệu). Số này được giữ để bảo vệ mạng, hạn chế cá mập gom và pump-dump, tương tự các ví sớm của Bitcoin vẫn nằm yên.

**8. Mỗi ngày phân phối bao nhiêu XPi?**  
Chỉ 21 XPi từ ví distributor.

**9. Mất bao lâu để phân phối hết phần dành cho cộng đồng?**  
Phần còn lại khoảng 53,55 triệu. Chia cho 21 XPi/ngày thì mất khoảng 6.986 năm.

**10. Tại sao phân phối chậm như vậy?**  
Để tạo sự khan hiếm lâu dài và giảm áp lực bán lớn ngay từ đầu.

**11. Có thể in thêm XPi không?**  
Không. Tổng cung cố định, chỉ phân phối theo lịch 21 XPi mỗi ngày.

**12. 15% nhóm giữ có bán ra không?**  
Mục đích chính là giữ để bảo vệ mạng, không dùng để tạo thanh khoản ngắn hạn hay pump-dump.

### Staking và tỷ lệ

**13. Staking XPi là gì?**  
Khóa XLM vào hợp đồng Soroban trên Stellar để nhận XPi theo thời gian.

**14. Mức stake tối thiểu là bao nhiêu?**  
31,4 XLM.

**15. Tỷ lệ thưởng thế nào?**  
Gần như tỷ lệ thuận với số XLM stake:  
- 31,4 XLM → khoảng 0,0000003 XPi/ngày  
- 314 XLM → khoảng 0,0000031 XPi/ngày  
- 3140 XLM → khoảng 0,000031 XPi/ngày  
- 31400 XLM → khoảng 0,00031 XPi/ngày  

**16. Stake nhiều hơn có nhận nhiều hơn không?**  
Có, tỷ lệ gần như tuyến tính. Càng stake nhiều càng nhận nhiều, nhưng tổng hệ thống vẫn chỉ phát 21 XPi/ngày.

**17. XLM có bị khóa không?**  
Có, trong lúc stake. Unstake thì XLM được trả lại ví.

**18. Phần thưởng tính thế nào?**  
Tính on-chain trong hợp đồng. Counter trên app chỉ là ước tính. Dùng chức năng Claim để nhận thật.

**19. Có thể unstake bất cứ lúc nào không?**  
Có. Unstake trả XLM về ví.

**20. Staking có tốn điện không?**  
Không. Chỉ tốn một ít phí mạng Stellar.

### Stellar và kỹ thuật

**21. Tại sao chọn Stellar?**  
Stellar đã có sẵn DEX, Soroban smart contract, phí rất thấp, tốc độ nhanh và có thể chạy nút trên máy tính thông thường.

**22. Soroban là gì?**  
Nền tảng smart contract của Stellar. Hợp đồng staking XPi chạy trên Soroban.

**23. DEX của Stellar dùng được với XPi không?**  
Có. Sau khi thêm trustline, có thể giao dịch XPi trực tiếp trên DEX Stellar.

**24. Memo là gì và XPi có hỗ trợ không?**  
Memo là ghi chú gắn vào giao dịch. Stellar và XPi hỗ trợ đầy đủ.

**25. Phí giao dịch bao nhiêu?**  
Rất thấp, thường chỉ vài phần trăm của 1 XLM.

**26. Giao dịch mất bao lâu?**  
Vài giây.

**27. Trustline là gì?**  
Là bước cho phép ví nhận XPi. Phải thêm trustline trước khi giữ được XPi.

**28. Làm sao thêm trustline?**  
Dùng ví như Albedo → Add trustline → tìm XPi từ nguồn chính thức.

**29. Nút Stellar có khó chạy không?**  
Không. Có thể chạy trên máy Ubuntu cấu hình trung bình.

**30. Mạng Stellar có thể bị tắt dễ dàng không?**  
Khó. Nhiều người có thể chạy nút độc lập, đồng thuận phân tán.

### Bảo mật và quyền sở hữu

**31. Private key nằm ở đâu?**  
Người dùng tự giữ bằng ví Stellar. Dự án không giữ key của bạn.

**32. Mất private key thì sao?**  
Mất coin, giống mọi blockchain khác. Nên backup cẩn thận.

**33. Số dư XPi có nằm trên server của dự án không?**  
Không. Nằm on-chain trên Stellar, bạn kiểm soát bằng private key.

**34. Có cần KYC không?**  
Không cần để stake và nhận XPi.

**35. Hợp đồng có kiểm tra được không?**  
Có. Mọi người có thể xem hợp đồng Soroban và giao dịch trên explorer Stellar.

**36. XPi có bị hack được không?**  
Rủi ro chính nằm ở cách bạn giữ ví và hợp đồng. Mạng Stellar đã hoạt động lâu năm.

### Tính nghiêm túc và dài hạn của dự án

**37. Tại sao nói dự án nghiêm túc?**  
Vì phân phối gần 7.000 năm, nhóm giữ 15% để bảo vệ mạng thay vì bán ra, và mọi thứ chạy on-chain minh bạch.

**38. Dự án có định pump-dump không?**  
Không. Không list CEX và phân phối cực chậm để giảm việc đó.

**39. Cloud mining có thuộc nhà phát triển không?**  
Không. Đó là hoạt động của người dùng mua XPi sớm, không phải của nhóm phát triển.

**40. Referral hoạt động thế nào?**  
Chỉ là tùy chọn giữa người dùng với nhau, không phải cơ chế cốt lõi của giao thức.

### So sánh và định vị

**41. XPi khác Pi Network thế nào?**  
XPi chạy on-chain từ đầu, người dùng giữ private key thật, không phụ thuộc server tập trung.

**42. XPi có phải “digital gold” không?**  
Đó là mục tiêu dài hạn: vừa khan hiếm vừa dễ tiếp cận cho mọi người.

**43. Có thể vừa hiếm vừa dễ sở hữu được không?**  
Có. XPi vừa phân phối cực chậm (hiếm) vừa cho phép stake từ 31,4 XLM (dễ sở hữu).

**44. Dự án có hứa lợi nhuận không?**  
Không. Chỉ định nghĩa quy tắc phát hành và staking. Giá do thị trường quyết định.

**45. Rủi ro lớn nhất là gì?**  
Rủi ro thị trường và rủi ro tự giữ private key. Chỉ dùng số tiền bạn chấp nhận được biến động.

### Bắt đầu nhanh

**46. Người mới bắt đầu nên làm gì?**  
Tạo ví Stellar → thêm trustline XPi chính thức → có một ít XLM → stake từ 31,4 XLM.

**47. Làm sao xác nhận đúng token XPi?**  
Kiểm tra issuer là `GDOFJE…LZFUEF` và domain xgoldmining.com trên Stellar Expert.

**48. Có cần app riêng không?**  
Có thể dùng app, CLI Node.js hoặc ví Stellar thông thường.

**49. XPi có thể chia nhỏ đến mức nào?**  
Stellar hỗ trợ chia rất nhỏ, thuận tiện cho việc tích lũy dần.

**50. Tóm lại, XPi giải quyết vấn đề gì?**  
Tạo ra một tài sản đủ khan hiếm để có tiềm năng lưu trữ giá trị dài hạn, đồng thời đủ đơn giản để người bình thường có thể sở hữu trực tiếp bằng cách stake XLM trên mạng công khai chi phí thấp.

---

[← Về trang chủ](index.html)
