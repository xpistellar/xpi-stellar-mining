#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, token,
};

const MIN_STAKE_PLAYER: i128 = 314_000_000;
const MIN_STAKE_DEV: i128 = 1_000_000_000;
const BASE_REWARD: i128 = 3;
const UNIT_XLM: i128 = 310_000_000;
const DAY: u64 = 86_400;
const MIN_STAKE_DURATION: u64 = 48 * DAY;
const MAX_GAME_PER_DAY: u32 = 10;
const MAX_DEV_PER_DAY: u32 = 200;

const FEE_TOPIC: i128 = 21;
const FEE_LIKE: i128 = 1;
const MIN_DISK_GB: u32 = 100;
const VIEW_MILESTONE: u64 = 1_000_000;
const DEFAULT_VIEW_REWARD: i128 = 10_000_000; // 1 XPi

#[contracttype]
#[derive(Clone)]
pub struct StakeInfo {
    pub amount: i128,
    pub start_time: u64,
    pub last_claim: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct DayCounter {
    pub day: u64,
    pub n: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct DiskCommit {
    pub gb: u32,
    pub at: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct Post {
    pub author: Address,
    pub created: u64,
    pub likes: u32,
    pub views: u64,
    pub claimed_views: u64,
}

#[contract]
pub struct XpiLock;

#[contractimpl]
impl XpiLock {
    pub fn init(env: Env, admin: Address, xpi: Address, xlm: Address) {
        admin.require_auth();
        if env.storage().instance().has(&symbol_short!("ok")) {
            panic!("already initialized");
        }
        env.storage().instance().set(&symbol_short!("admin"), &admin);
        env.storage().instance().set(&symbol_short!("xpi"), &xpi);
        env.storage().instance().set(&symbol_short!("xlm"), &xlm);
        env.storage().instance().set(&symbol_short!("paused"), &false);
        env.storage().instance().set(&symbol_short!("ok"), &true);
        env.storage().instance().set(&symbol_short!("vrew"), &DEFAULT_VIEW_REWARD);
        env.storage().instance().extend_ttl(100_000, 100_000);
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&symbol_short!("admin")).unwrap();
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    pub fn set_paused(env: Env, paused: bool) {
        Self::admin(&env).require_auth();
        env.storage().instance().set(&symbol_short!("paused"), &paused);
    }

    pub fn set_oracle(env: Env, oracle: Address) {
        Self::admin(&env).require_auth();
        env.storage().instance().set(&symbol_short!("oracle"), &oracle);
    }

    pub fn set_view_reward(env: Env, amount: i128) {
        Self::admin(&env).require_auth();
        if amount < 0 {
            panic!("invalid amount");
        }
        env.storage().instance().set(&symbol_short!("vrew"), &amount);
    }

    pub fn deposit_xpi(env: Env, from: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic!("invalid amount");
        }
        let xpi: Address = env.storage().instance().get(&symbol_short!("xpi")).unwrap();
        token::Client::new(&env, &xpi).transfer(&from, &env.current_contract_address(), &amount);
    }

    pub fn stake(env: Env, user: Address, amount: i128) {
        Self::require_not_paused(&env);
        user.require_auth();
        if amount <= 0 {
            panic!("invalid amount");
        }
        let xlm: Address = env.storage().instance().get(&symbol_short!("xlm")).unwrap();
        token::Client::new(&env, &xlm).transfer(&user, &env.current_contract_address(), &amount);
        let now = env.ledger().timestamp();
        let mut s = env.storage().persistent().get(&user).unwrap_or(StakeInfo {
            amount: 0,
            start_time: 0,
            last_claim: now,
        });
        let old_amount = s.amount;
        s.amount = s.amount.checked_add(amount).expect("overflow");
        if old_amount < MIN_STAKE_PLAYER && s.amount >= MIN_STAKE_PLAYER {
            s.start_time = now;
        }
        env.storage().persistent().set(&user, &s);
        env.storage().persistent().extend_ttl(&user, 50_000, 50_000);
    }

    pub fn unstake(env: Env, user: Address, amount: i128) {
        Self::require_not_paused(&env);
        user.require_auth();
        let mut s: StakeInfo = env.storage().persistent().get(&user).unwrap_or_else(|| panic!("no stake"));
        let out = if amount <= 0 || amount >= s.amount { s.amount } else { amount };
        if out <= 0 {
            panic!("zero");
        }
        s.amount -= out;
        if s.amount < MIN_STAKE_PLAYER {
            s.start_time = 0;
        }
        if s.amount == 0 {
            env.storage().persistent().remove(&user);
        } else {
            env.storage().persistent().set(&user, &s);
            env.storage().persistent().extend_ttl(&user, 50_000, 50_000);
        }
        let xlm: Address = env.storage().instance().get(&symbol_short!("xlm")).unwrap();
        token::Client::new(&env, &xlm).transfer(&env.current_contract_address(), &user, &out);
    }

    pub fn claim(env: Env, user: Address) {
        Self::require_not_paused(&env);
        user.require_auth();
        let mut s: StakeInfo = env.storage().persistent().get(&user).unwrap_or_else(|| panic!("no stake"));
        let now = env.ledger().timestamp();
        if now <= s.last_claim || s.amount <= 0 {
            panic!("nothing to claim");
        }
        let elapsed = (now - s.last_claim) as i128;
        let reward = s.amount * BASE_REWARD * elapsed / (UNIT_XLM * (DAY as i128));
        if reward <= 0 {
            panic!("reward too small");
        }
        s.last_claim = now;
        env.storage().persistent().set(&user, &s);
        env.storage().persistent().extend_ttl(&user, 50_000, 50_000);
        Self::transfer_xpi(&env, &user, reward);
    }

    pub fn claim_game(env: Env, user: Address) {
        Self::require_not_paused(&env);
        user.require_auth();
        Self::require_player_eligible(&env, &user);
        let day = env.ledger().timestamp() / DAY;
        let key = (symbol_short!("gday"), user.clone());
        let mut g: DayCounter = env.storage().persistent().get(&key).unwrap_or(DayCounter { day: 0, n: 0 });
        if g.day != day {
            g.day = day;
            g.n = 0;
        }
        if g.n >= MAX_GAME_PER_DAY {
            panic!("daily game limit reached");
        }
        g.n += 1;
        env.storage().persistent().set(&key, &g);
        env.storage().persistent().extend_ttl(&key, 50_000, 50_000);
        Self::transfer_xpi(&env, &user, BASE_REWARD);
    }

    pub fn bind_developer(env: Env, user: Address, developer: Address) {
        Self::require_not_paused(&env);
        user.require_auth();
        let key = (symbol_short!("bind"), user.clone());
        if env.storage().persistent().has(&key) {
            panic!("already bound");
        }
        env.storage().persistent().set(&key, &developer);
        env.storage().persistent().extend_ttl(&key, 50_000, 50_000);
    }

    pub fn claim_for_developer(env: Env, user: Address) {
        Self::require_not_paused(&env);
        user.require_auth();
        Self::require_player_eligible(&env, &user);
        let bind_key = (symbol_short!("bind"), user.clone());
        let developer: Address = env.storage().persistent().get(&bind_key).unwrap_or_else(|| panic!("not bound"));
        Self::require_developer_eligible(&env, &developer);
        let day = env.ledger().timestamp() / DAY;
        let user_key = (symbol_short!("udev"), user.clone());
        let mut user_c: DayCounter = env.storage().persistent().get(&user_key).unwrap_or(DayCounter { day: 0, n: 0 });
        if user_c.day == day && user_c.n >= 1 {
            panic!("already claimed for developer today");
        }
        user_c.day = day;
        user_c.n = 1;
        env.storage().persistent().set(&user_key, &user_c);
        env.storage().persistent().extend_ttl(&user_key, 50_000, 50_000);
        let dev_key = (symbol_short!("ddev"), developer.clone());
        let mut dev_c: DayCounter = env.storage().persistent().get(&dev_key).unwrap_or(DayCounter { day: 0, n: 0 });
        if dev_c.day != day {
            dev_c.day = day;
            dev_c.n = 0;
        }
        if dev_c.n >= MAX_DEV_PER_DAY {
            panic!("developer daily limit reached");
        }
        dev_c.n += 1;
        env.storage().persistent().set(&dev_key, &dev_c);
        env.storage().persistent().extend_ttl(&dev_key, 50_000, 50_000);
        Self::transfer_xpi(&env, &developer, BASE_REWARD);
    }

    pub fn pay_fee(env: Env, user: Address, amount: i128) {
        Self::require_not_paused(&env);
        user.require_auth();
        if amount <= 0 {
            panic!("invalid amount");
        }
        let xpi: Address = env.storage().instance().get(&symbol_short!("xpi")).unwrap();
        token::Client::new(&env, &xpi).transfer(&user, &env.current_contract_address(), &amount);
    }

    pub fn like(env: Env, from: Address, to: Address, amount: i128) {
        Self::require_not_paused(&env);
        from.require_auth();
        if amount <= 0 {
            panic!("invalid amount");
        }
        let xpi: Address = env.storage().instance().get(&symbol_short!("xpi")).unwrap();
        token::Client::new(&env, &xpi).transfer(&from, &to, &amount);
    }

    /// Cam kết disk. Chain không đo được ổ đĩa; node P2P chỉ đọc số này để xếp super-peer.
    pub fn commit_disk(env: Env, user: Address, gb: u32) {
        Self::require_not_paused(&env);
        user.require_auth();
        let row = DiskCommit { gb, at: env.ledger().timestamp() };
        let key = (symbol_short!("disk"), user);
        env.storage().persistent().set(&key, &row);
        env.storage().persistent().extend_ttl(&key, 50_000, 50_000);
    }

    pub fn can_write(env: Env, user: Address) -> bool {
        Self::check_eligible(&env, &user, MIN_STAKE_PLAYER) && Self::disk_gb(&env, &user) >= MIN_DISK_GB
    }

    /// Tạo topic: cần stake XLM đủ 48h và disk >= 100 GB. Thu 0.0000021 XPi vào quỹ.
    pub fn pay_for_topic(env: Env, user: Address, post_id: BytesN<32>) {
        Self::require_not_paused(&env);
        user.require_auth();
        if !Self::can_write(env.clone(), user.clone()) {
            panic!("need 31.4 XLM for 48h and 100 GB disk");
        }
        let key = (symbol_short!("post"), post_id);
        if env.storage().persistent().has(&key) {
            panic!("post exists");
        }
        let xpi: Address = env.storage().instance().get(&symbol_short!("xpi")).unwrap();
        token::Client::new(&env, &xpi).transfer(&user, &env.current_contract_address(), &FEE_TOPIC);
        let post = Post {
            author: user,
            created: env.ledger().timestamp(),
            likes: 0,
            views: 0,
            claimed_views: 0,
        };
        env.storage().persistent().set(&key, &post);
        env.storage().persistent().extend_ttl(&key, 50_000, 50_000);
    }

    /// Like: 0.0000001 XPi từ người like sang tác giả. Cần quyền viết.
    pub fn like_post(env: Env, from: Address, post_id: BytesN<32>) {
        Self::require_not_paused(&env);
        from.require_auth();
        if !Self::can_write(env.clone(), from.clone()) {
            panic!("comment rights required");
        }
        let key = (symbol_short!("post"), post_id);
        let mut post: Post = env.storage().persistent().get(&key).unwrap_or_else(|| panic!("no post"));
        if post.author == from {
            panic!("self like");
        }
        let xpi: Address = env.storage().instance().get(&symbol_short!("xpi")).unwrap();
        token::Client::new(&env, &xpi).transfer(&from, &post.author, &FEE_LIKE);
        post.likes = post.likes.saturating_add(1);
        env.storage().persistent().set(&key, &post);
        env.storage().persistent().extend_ttl(&key, 50_000, 50_000);
    }

    /// View không tự khai. Oracle (node bootstrap) ghi mốc đã thấy.
    pub fn attest_views(env: Env, oracle: Address, post_id: BytesN<32>, views: u64) {
        Self::require_not_paused(&env);
        oracle.require_auth();
        let expected: Address = env.storage().instance().get(&symbol_short!("oracle")).unwrap_or_else(|| panic!("no oracle"));
        if oracle != expected {
            panic!("not oracle");
        }
        let key = (symbol_short!("post"), post_id);
        let mut post: Post = env.storage().persistent().get(&key).unwrap_or_else(|| panic!("no post"));
        if views > post.views {
            post.views = views;
            env.storage().persistent().set(&key, &post);
            env.storage().persistent().extend_ttl(&key, 50_000, 50_000);
        }
    }

    /// Mỗi lần chạm thêm 1_000_000 view, tác giả nhận thưởng từ quỹ XPi một lần.
    pub fn claim_view_reward(env: Env, creator: Address, post_id: BytesN<32>) {
        Self::require_not_paused(&env);
        creator.require_auth();
        let key = (symbol_short!("post"), post_id);
        let mut post: Post = env.storage().persistent().get(&key).unwrap_or_else(|| panic!("no post"));
        if post.author != creator {
            panic!("not author");
        }
        let reached = (post.views / VIEW_MILESTONE) * VIEW_MILESTONE;
        if reached == 0 || reached <= post.claimed_views {
            panic!("milestone not reached");
        }
        let steps = ((reached - post.claimed_views) / VIEW_MILESTONE) as i128;
        let each: i128 = env.storage().instance().get(&symbol_short!("vrew")).unwrap_or(DEFAULT_VIEW_REWARD);
        post.claimed_views = reached;
        env.storage().persistent().set(&key, &post);
        env.storage().persistent().extend_ttl(&key, 50_000, 50_000);
        Self::transfer_xpi(&env, &creator, each.saturating_mul(steps));
    }

    pub fn get_stake(env: Env, user: Address) -> Option<StakeInfo> {
        env.storage().persistent().get(&user)
    }

    pub fn get_disk(env: Env, user: Address) -> Option<DiskCommit> {
        let key = (symbol_short!("disk"), user);
        env.storage().persistent().get(&key)
    }

    pub fn get_post(env: Env, post_id: BytesN<32>) -> Option<Post> {
        let key = (symbol_short!("post"), post_id);
        env.storage().persistent().get(&key)
    }

    pub fn pending(env: Env, user: Address) -> i128 {
        let s: StakeInfo = match env.storage().persistent().get(&user) {
            Some(x) => x,
            None => return 0,
        };
        let now = env.ledger().timestamp();
        if now <= s.last_claim || s.amount <= 0 {
            return 0;
        }
        let elapsed = (now - s.last_claim) as i128;
        s.amount * BASE_REWARD * elapsed / (UNIT_XLM * (DAY as i128))
    }

    pub fn game_left(env: Env, user: Address) -> u32 {
        let day = env.ledger().timestamp() / DAY;
        let key = (symbol_short!("gday"), user);
        let g: DayCounter = env.storage().persistent().get(&key).unwrap_or(DayCounter { day: 0, n: 0 });
        if g.day != day {
            return MAX_GAME_PER_DAY;
        }
        MAX_GAME_PER_DAY.saturating_sub(g.n)
    }

    pub fn get_bound_developer(env: Env, user: Address) -> Option<Address> {
        let key = (symbol_short!("bind"), user);
        env.storage().persistent().get(&key)
    }

    pub fn dev_reward_left(env: Env, developer: Address) -> u32 {
        let day = env.ledger().timestamp() / DAY;
        let key = (symbol_short!("ddev"), developer);
        let c: DayCounter = env.storage().persistent().get(&key).unwrap_or(DayCounter { day: 0, n: 0 });
        if c.day != day {
            return MAX_DEV_PER_DAY;
        }
        MAX_DEV_PER_DAY.saturating_sub(c.n)
    }

    pub fn is_player_eligible(env: Env, user: Address) -> bool {
        Self::check_eligible(&env, &user, MIN_STAKE_PLAYER)
    }

    pub fn is_developer_eligible(env: Env, developer: Address) -> bool {
        Self::check_eligible(&env, &developer, MIN_STAKE_DEV)
    }

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&symbol_short!("admin")).unwrap()
    }

    fn disk_gb(env: &Env, user: &Address) -> u32 {
        let key = (symbol_short!("disk"), user.clone());
        env.storage().persistent().get::<_, DiskCommit>(&key).map(|d| d.gb).unwrap_or(0)
    }

    fn require_not_paused(env: &Env) {
        let paused: bool = env.storage().instance().get(&symbol_short!("paused")).unwrap_or(false);
        if paused {
            panic!("contract paused");
        }
    }

    fn require_player_eligible(env: &Env, user: &Address) {
        if !Self::check_eligible(env, user, MIN_STAKE_PLAYER) {
            panic!("player not eligible (need ≥ 31.4 XLM for 48h)");
        }
    }

    fn require_developer_eligible(env: &Env, developer: &Address) {
        if !Self::check_eligible(env, developer, MIN_STAKE_DEV) {
            panic!("developer not eligible (need ≥ 100 XLM for 48h)");
        }
    }

    fn check_eligible(env: &Env, addr: &Address, min_amount: i128) -> bool {
        match env.storage().persistent().get::<_, StakeInfo>(addr) {
            Some(s) => s.amount >= min_amount && s.start_time > 0 && env.ledger().timestamp() >= s.start_time + MIN_STAKE_DURATION,
            None => false,
        }
    }

    fn transfer_xpi(env: &Env, to: &Address, amount: i128) {
        let xpi: Address = env.storage().instance().get(&symbol_short!("xpi")).unwrap();
        token::Client::new(env, &xpi).transfer(&env.current_contract_address(), to, &amount);
    }
}
