<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>XPi Lock Staking</title>
  <link rel="stylesheet" href="css/style.css">
  <!-- Stellar SDK local (không dùng CDN) -->
  <script src="lib/stellar-sdk.min.js"></script>
</head>
<body>
  <div class="container">
    <header>
      <h1>XPi Lock Staking</h1>
      <p class="subtitle">Contract: CDQ4OO3F... | Min stake: 31.4 XLM</p>
    </header>

    <section class="card">
      <label for="secret">Private Key (S...)</label>
      <div class="input-group">
        <input type="password" id="secret" placeholder="S................................." autocomplete="off">
        <button type="button" id="toggleSecret" class="btn-icon" title="Hiện/Ẩn">👁</button>
      </div>
      <p class="hint">Private key chỉ chạy trên trình duyệt của bạn, không gửi lên server.</p>
    </section>

    <section class="card actions">
      <h2>Chức năng</h2>
      <div class="btn-grid">
        <button id="btnStake" class="btn primary">1. Stake XLM</button>
        <button id="btnUnstake" class="btn">2. Unstake</button>
        <button id="btnClaim" class="btn">3. Claim thưởng</button>
        <button id="btnGetStake" class="btn secondary">4. Xem get_stake</button>
        <button id="btnPending" class="btn secondary">5. Xem pending</button>
      </div>
    </section>

    <section class="card" id="amountSection" style="display:none;">
      <label for="amount">Số lượng XLM</label>
      <input type="number" id="amount" step="0.1" min="0" placeholder="Ví dụ: 31.4">
      <p class="hint" id="amountHint"></p>
      <button id="btnConfirm" class="btn primary full">Xác nhận</button>
      <button id="btnCancel" class="btn full">Hủy</button>
    </section>

    <section class="card log-card">
      <div class="log-header">
        <h2>Nhật ký</h2>
        <button id="btnClearLog" class="btn-small">Xóa</button>
      </div>
      <pre id="log"></pre>
    </section>
  </div>

  <script src="js/app.js"></script>
</body>
</html>
