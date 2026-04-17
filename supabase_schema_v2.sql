-- 好友关系表
create table if not exists friendships (
  id uuid default gen_random_uuid() primary key,
  requester_id uuid references profiles(id) on delete cascade not null,
  addressee_id uuid references profiles(id) on delete cascade not null,
  status text check (status in ('pending', 'accepted')) default 'pending',
  created_at timestamp with time zone default timezone('utc', now()),
  unique(requester_id, addressee_id)
);

-- 亲密关系表（核心圈，最多12人）
create table if not exists close_friends (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  friend_id uuid references profiles(id) on delete cascade not null,
  last_interaction timestamp with time zone default timezone('utc', now()),
  created_at timestamp with time zone default timezone('utc', now()),
  unique(user_id, friend_id)
);

-- 每日冠军表
create table if not exists champions (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade,
  comment_id uuid references comments(id) on delete cascade,
  type text check (type in ('peak', 'healing')) not null,
  date date not null,
  period text check (period in ('noon', 'night')) not null,
  created_at timestamp with time zone default timezone('utc', now()),
  unique(date, period, type)
);

-- 攻坚投递表
create table if not exists breakthroughs (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references profiles(id) on delete cascade not null,
  target_id uuid references profiles(id) on delete cascade not null,
  original_content text not null,
  polished_content text not null,
  is_liked boolean default false,
  viewed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 互动记录（用于亲密关系门控）
create table if not exists interactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  post_id uuid references posts(id) on delete cascade not null,
  has_liked boolean default false,
  has_commented boolean default false,
  created_at timestamp with time zone default timezone('utc', now()),
  unique(user_id, post_id)
);

-- 在profiles表加energy_score字段
alter table profiles add column if not exists energy_score integer default 0;

-- RLS
alter table friendships enable row level security;
alter table close_friends enable row level security;
alter table champions enable row level security;
alter table breakthroughs enable row level security;
alter table interactions enable row level security;

create policy "friendships: public read" on friendships for select using (true);
create policy "friendships: auth insert" on friendships for insert with check (auth.uid() = requester_id);
create policy "friendships: own update" on friendships for update using (auth.uid() = addressee_id);

create policy "close_friends: own read" on close_friends for select using (auth.uid() = user_id);
create policy "close_friends: own insert" on close_friends for insert with check (auth.uid() = user_id);
create policy "close_friends: own delete" on close_friends for delete using (auth.uid() = user_id);

create policy "champions: public read" on champions for select using (true);

create policy "breakthroughs: own read" on breakthroughs for select using (auth.uid() = sender_id or auth.uid() = target_id);
create policy "breakthroughs: auth insert" on breakthroughs for insert with check (auth.uid() = sender_id);
create policy "breakthroughs: target update" on breakthroughs for update using (auth.uid() = target_id);

create policy "interactions: own read" on interactions for select using (auth.uid() = user_id);
create policy "interactions: auth insert" on interactions for insert with check (auth.uid() = user_id);
create policy "interactions: own update" on interactions for update using (auth.uid() = user_id);
