<?php
/**
 * Optional: upload/extract detector for shared hosts.
 * Forum P2P backend is Node.js — PHP alone cannot run the node.
 */
header('Content-Type: text/html; charset=utf-8');
$node = trim(shell_exec('command -v node 2>/dev/null') ?: '');
$ver = $node ? trim(shell_exec('node -v 2>/dev/null') ?: '') : '';
?><!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>Forum P2P — host check</title>
<style>body{font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px;line-height:1.5}
.ok{color:#0a7c66}.bad{color:#b42318}code{background:#f4f4f4;padding:2px 6px}</style></head><body>
<h1>Forum P2P — kiểm tra host</h1>
<p>Ứng dụng forum là <strong>Node.js</strong> (Express), không phải PHP forum.</p>
<ul>
<li>Node binary: <?php echo $node ? '<span class="ok">'.htmlspecialchars($node).'</span>' : '<span class="bad">không tìm thấy</span>'; ?></li>
<li>Phiên bản: <?php echo $ver ? '<span class="ok">'.htmlspecialchars($ver).'</span>' : '<span class="bad">—</span>'; ?></li>
</ul>
<?php if ($node && version_compare(ltrim($ver, 'v'), '18.0.0', '>=')): ?>
<p class="ok">Host có Node ≥ 18. Cài bằng SSH:</p>
<pre>cd thư-mục-giải-nén
npm run install-node
./run-node.sh</pre>
<?php else: ?>
<p class="bad">Host này chỉ PHP hoặc Node quá cũ — <strong>không chạy được</strong> forum-p2p.
Dùng VPS Ubuntu / cloud / hosting có “Setup Node.js App”.</p>
<?php endif; ?>
<p>Xem <code>VERSION.md</code> và <code>CAI-DAT.md</code>.</p>
</body></html>
