# STARFALL — математическая спецификация полёта и боя пиратского истребителя типа 0

**Статус:** извлечено из production-кода `starfall.html` ветки `fix/transport-escort-traffic-v103` (PR #52), версия игры v103.  
**Назначение:** зафиксировать наблюдаемую реализацию без проектных дополнений и без подмены фактических формул идеализированной моделью.  
**Эталон:** пиратский истребитель типа 0 — «Головорез» / Rust Skull, GLB `MC.p0`.  
**Основные реализации:** `EAI`, `pirateFleetPhase`, `pirateFleetUpdate`, `pcPhase`, `pcFight`, `pcFire`, `pcOrient`.

> Числа ниже — игровые единицы и секунды STARFALL. Это не SI-модель и не бит-точная реконструкция Elite. Комментарии Elite в исходнике указывают происхождение отдельных структурных идей; конкретные пороги и коэффициенты являются параметрами STARFALL.

## 1. Границы и две фактические реализации

В коде есть два близких, но не идентичных контура Головореза:

1. **Стартовая/боевая эскадрилья** — `pirateFleetUpdate` + `pirateFleetPhase`. Это эталонный профиль типа 0, подробно описанный в разделах 2–8.
2. **Истребитель сопровождения каравана** — `pcFight` + `pcPhase` + `pcFire`. Он использует то же ядро `EAI` и те же параметры типа 0 для атаки, но отдельную функцию стрельбы и фазовый контроллер. Его отличия перечислены в разделе 9.

Свободные пираты (`roamingPirateUpdate`) повторно используют `pirateFleetPhase` и `EAI`, но имеют отдельные параметры патруля и огня. Не следует считать все NPC одним и тем же полным алгоритмом только потому, что они вызывают общий интегратор.

## 2. Обозначения и система координат

Для корабля:

- \(\mathbf p\) — мировая позиция объекта `g.position`;
- \(\mathbf v\) — мировая скорость `e.vel`;
- \(\mathbf h\) — единичный вектор направления носа `e.hd`;
- \(\mathbf u=(0,1,0)\) — мировой up-вектор `pirateFleetUp`;
- \(\mathbf r_t=\mathbf p_t-\mathbf p\) — вектор от корабля к игроку;
- \(d=\|\mathbf r_t\|\) — дистанция;
- \(\hat{\mathbf t}=\mathbf r_t/\max(d,1)\) — единичное направление на игрока.

Локальный правый вектор:

\[
\mathbf right=\frac{\mathbf h\times\mathbf u}
 {\|\mathbf h\times\mathbf u\|}
\]

Если квадрат длины результата меньше \(10^{-8}\), код использует fallback \((1,0,0)\), затем нормализует вектор.

Локальная вертикаль:

\[
\mathbf up_l=\frac{\mathbf right\times\mathbf h}
 {\|\mathbf right\times\mathbf h\|}
\]

Относительный вектор цели в локальных проекциях:

\[
x=\mathbf r_t\cdot\mathbf right,\qquad
y=\mathbf r_t\cdot\mathbf up_l,\qquad
z=\mathbf r_t\cdot\mathbf h
\]

В фазовом контроллере дополнительно вычисляется продольная проекция направления на цель:

\[
l_z=\hat{\mathbf t}\cdot\mathbf h
\]

## 3. Дискретизация тактического решения

Константа:

\[
\Delta t_{AI}=\frac{4}{60}=0.066666\ldots\text{ s}
\]

Функция `EAI.think(e,dt)` накапливает:

\[
c_{n+1}=c_n+\operatorname{clamp}(dt,0,0.1)
\]

Если \(c<\Delta t_{AI}\), тактический шаг не выполняется. Иначе:

\[
c\leftarrow c-\Delta t_{AI},\qquad ticks\leftarrow ticks+1
\]

Функция возвращает `true` на тактическом шаге. Следовательно, решение AI обновляется с номинальной частотой 15 Гц при обычном 60 FPS, а интеграция движения выполняется каждый игровой кадр.

PRNG — xorshift32:

\[
x\mathrel{\oplus}=x\ll13;\quad
x\mathrel{\oplus}=x\gg17;\quad
x\mathrel{\oplus}=x\ll5
\]

\[
rand=\frac{x\mathbin{>>>}0}{2^{32}}
\]

Начальное состояние по умолчанию: `0x6d2b79f5`. Для стартовой эскадрильи seed задаётся из номера системы, волны и счёта:

\[
seed=((sy+1)C_1)\oplus((wave+1)C_2)\oplus((score+1)C_3)
\]

где константы в коде: `0x9e3779b1`, `0x85ebca6b`, `0xc2b2ae35`.

## 4. Тактический автомат эскадрильи

Функция: `pirateFleetPhase(e,toPlayer,dist,incoming,aiThink,dt)`.

Состояния: `ATTACK`, `BREAK`, `RESET`. При отсутствии фазы начальное состояние — `ATTACK`.

Каждый кадр:

\[
phT\leftarrow phT+dt
\]
\[
jinkCd\leftarrow\max(0,jinkCd-dt),\quad
jinkT\leftarrow\max(0,jinkT-dt)
\]

### 4.1. Переход ATTACK → BREAK

Только на тактическом шаге `aiThink`. Переход выполняется, если истинно хотя бы одно условие:

\[
d< D_{break}(type)
\]
или
\[
phT>1.2\land l_z<-0.2\land d<420
\]
или
\[
phT>7
\]

Массивы порогов в исходнике:

| Тип | \(D_{break}\) | Время BREAK | Дистанция RESET |
|---:|---:|---:|---:|
| 0 — Головорез | 140 | 1.6 s | 400 |
| 1 — Шакал | 150 | 1.4 s | 380 |
| 2 — Мародёр | 210 | 2.0 s | 460 |
| 3 — Гарпия | 160 | 1.6 s | 420 |

При переходе выбираются независимые знаки \(s_x,s_y\in\{-1,+1\}\) через PRNG:

\[
\mathbf b=
\operatorname{normalize}
(\mathbf h+0.8s_x\mathbf right+0.35s_y\mathbf u)
\]

\[
phase\leftarrow BREAK,\quad phT\leftarrow0
\]

### 4.2. Уклонение от входящего снаряда (jink)

В состоянии ATTACK, если снаряд обнаружен, cooldown завершён и случайная проверка проходит:

\[
incoming\land(jinkCd\le0)\land(rand<0.6)
\]

то:

\[
jinkT=0.45,\quad jinkSide\in\{-1,+1\},\quad jinkCd=2.2
\]

Jink не меняет основную фазу. Пока \(jinkT>0\), направление атаки модифицируется:

\[
\mathbf a=\operatorname{normalize}
(\hat{\mathbf t}+0.9\,jinkSide\,\mathbf right+0.25\,\mathbf u)
\]

### 4.3. BREAK → RESET → ATTACK

\[
BREAK\to RESET\quad\text{при}\quad phT\ge T_{break}(type)
\]

При входе в RESET таймер сбрасывается. В RESET:

\[
RESET\to ATTACK
\]

если:

\[
(phT\ge0.8\land d>D_{reset}(type))\lor(phT>6)
\]

При возврате в ATTACK выбирается новый знак фланга \(flank\in\{-1,+1\}\).

### 4.4. Выходной вектор фазы

В ATTACK:

\[
\mathbf a=\hat{\mathbf t}
\]

с описанной выше jink-поправкой, если она активна.

В BREAK:

\[
\mathbf a=\mathbf b
\]

В RESET:

\[
\mathbf a=\operatorname{normalize}
\left(\operatorname{lerp}(\mathbf b,\hat{\mathbf t},
\min(0.45,0.12\,phT))\right)
\]

Затем:

\[
state=aiIntent=
\begin{cases}
ATTACK,&phase=ATTACK\\
EVADE,&phase\in\{BREAK,RESET\}
\end{cases}
\]

## 5. Профиль движения Головореза (type 0)

Функция: `pirateFleetUpdate`.

Для типа 0 в ATTACK базовые параметры:

\[
v_{target}=\begin{cases}
54,&d>260\\
43,&d\le260
\end{cases}
\qquad
\omega_{max}=2.05
\qquad
a_{max}=68
\]

Перед профилем корабля вектор фазы получает общий боковой компонент эскадрильи:

\[
\mathbf a_1=\operatorname{normalize}
(\mathbf a+0.22s_{slot}\mathbf right_t)
\]

где \(s_{slot}=-1\) при `slot===0`, иначе \(+1\), а \(\mathbf right_t\) вычисляется как нормализованное \(\hat{\mathbf t}\times\mathbf u\).

Затем специфическая поправка Головореза:

\[
\mathbf a_2=
\operatorname{normalize}
\left(\operatorname{lerp}(\mathbf a_1,\hat{\mathbf t},0.38)\right)
\]

В фазах BREAK/RESET ветка профиля типа 0 не выполняется: сохраняется выходной вектор фазового автомата. Целевая скорость вне ATTACK берётся из массива:

\[
v_{target}=50
\]

Сложность масштабирует скорость и ускорение:

\[
v_{target}\leftarrow v_{target}\cdot DF[dif].sp
\]
\[
a_{max}\leftarrow a_{max}\cdot DF[dif].ac
\]

На каждом тактическом шаге направление сглаживается:

\[
\mathbf a_s=
\begin{cases}
\operatorname{normalize}(\mathbf a_2),&\text{первый шаг}\\
\operatorname{normalize}(\operatorname{lerp}(\mathbf a_{s,prev},\mathbf a_2,0.4)),
&\text{иначе}
\end{cases}
\]

Команда передаётся в `EAI.command`.

## 6. Математика EAI.command

Сначала вычисляется локальная проекция направления через `projectOCS`.

Для нормализованного направления \(\mathbf d\), носа \(\mathbf h\), локальных \(\mathbf r,\mathbf u\):

\[
\mathbf d_{1/2}=0.5\,\operatorname{normalize}(\mathbf d)
\]

\[
h=-\mathbf r\cdot\mathbf d_{1/2},\quad
l=-\mathbf u\cdot\mathbf d_{1/2},\quad
d_{ocs}=-\mathbf h\cdot\mathbf d_{1/2}
\]

Квантование управляющих команд:

\[
Q(x)=\operatorname{sign}(x)\min(15,\lfloor30|x|+0.5\rfloor)
\]

\[
yaw=Q(h),\qquad pitch=-Q(l)
\]

Дистанционный байт:

\[
rangeByte=\min(255,\lfloor\max(0,distance)/32\rfloor)
\]

Команда ускорения:

\[
accel=
\begin{cases}
2,&rangeByte>12\\
-1,&rangeByte<5\\
1,&\text{иначе}
\end{cases}
\]

Если \(|h|>0.28\) или \(|l|>0.28\), команда уменьшается:

\[
accel\leftarrow\max(0,accel-1)
\]

Сохраняются также параметры команды:

\[
v_{cmd}=\max(0,options.speed),\quad
a_{max}=\max(1,options.acceleration),\quad
\omega_{max}=\max(0.1,options.turnRate)
\]

## 7. Непрерывная интеграция EAI.integrate

Выполняется каждый кадр с шагом \(dt\).

Локальная вертикаль строится из текущих \(\mathbf h\), \(\mathbf u\). Если правый вектор вырожден, используется \((1,0,0)\).

Углы поворота:

\[
\Delta\psi=\frac{yaw}{15}\omega_{max}dt
\]
\[
\Delta\theta=\frac{pitch}{15}\omega_{max}dt
\]

Сначала \(\mathbf h\) поворачивается вокруг локальной вертикали на \(\Delta\psi\), затем вокруг обновлённой локальной правой оси на \(\Delta\theta\). После этого нормализуется.

Коэффициент газа:

\[
\tau(accel)=
\begin{cases}
1,&accel=2\\
0.92,&accel=1\\
0.78,&accel=0\\
0.55,&accel=-1
\end{cases}
\]

Целевая скорость:

\[
v^*=v_{cmd}\tau
\]

Скалярная скорость изменяется с ограничением ускорения:

\[
v_{n+1}=\max(0,v_n)+
\operatorname{clamp}(v^*-v_n,-a_{max}dt,a_{max}dt)
\]

Желаемый вектор скорости:

\[
\mathbf v^*=v_{n+1}\mathbf h
\]

Векторная коррекция скорости также ограничена:

\[
\Delta\mathbf v=\mathbf v^*-\mathbf v_n
\]

\[
\mathbf v_{n+1}=\mathbf v_n+
\begin{cases}
\Delta\mathbf v,&\|\Delta\mathbf v\|\le a_{max}dt\\
a_{max}dt\dfrac{\Delta\mathbf v}{\|\Delta\mathbf v\|},&\text{иначе}
\end{cases}
\]

Положение обновляется явным шагом Эйлера:

\[
\mathbf p_{n+1}=\mathbf p_n+\mathbf v_{n+1}dt
\]

Это точное описание операций текущего `EAI.integrate`, включая отдельное ограничение изменения скалярной скорости и вектора скорости.

## 8. Ориентация и крен модели

В эскадрилье направление ориентации берётся из скорости, если скорость ненулевая; иначе из \(\mathbf h\).

При почти вертикальном направлении:

\[
|\hat{\mathbf v}\cdot\mathbf u|>0.985
\]

в качестве up для матрицы ориентации берётся \((0,0,1)\), иначе \((0,1,0)\).

Целевой крен:

\[
bank^*=\operatorname{clamp}
\left(-\frac{ocsYaw}{15}\cdot0.24,-0.24,0.24\right)
\]

Сглаживание:

\[
bank_{n+1}=bank_n+(bank^*-bank_n)(1-e^{-5.5dt})
\]

Итоговый кватернион:

\[
q=q_{lookAt}\,q_{roll}(bank)
\]

где roll выполняется вокруг локальной оси `pirateFleetForward=(0,0,-1)`.

## 9. Стрельба стартовой эскадрильи (type 0)

В `pirateFleetUpdate`:

\[
v_{shot}=200
\]
\[
t_{lead}=\min(6.2,d/v_{shot})
\]
\[
\mathbf p_{aim}=\mathbf P+\mathbf v_{player}t_{lead}
\]
\[
\hat{\mathbf a}=\operatorname{normalize}(\mathbf p_{aim}-\mathbf p_{pirate})
\]

Проекция на направление корабля:

\[
proj=EAI.project(\hat{\mathbf a},\hat{\mathbf h})
\]
\[
fireAngle=\arccos(\operatorname{clamp}(proj.forward,-1,1))
\]

Для типа 0:

\[
range=390,\qquad cone=0.82\text{ rad}
\]

Огневое окно:

\[
canFire=(state=ATTACK)\land(d<390)\land
\left((fireAngle<0.82)\lor(d<260\land fireAngle<1.3)\right)
\]

Вероятность допуска огня:

\[
alignment=\operatorname{clamp}((forward-0.5)/0.5,0,1)
\]
\[
proximity=\operatorname{clamp}(1-d/range,0,1)
\]
\[
chance=\operatorname{clamp}(0.25+0.55alignment+0.2proximity,0.2,0.98)
\]

Дополнительный gate `EAI.fireGate`:

\[
rangeByte=\lfloor\max(0,d)/32\rfloor
\]
\[
signX=(h<0),\quad signD=(d_{ocs}<0),\quad xor=(signX\ne signD)
\]
\[
centered=(|h|\le0.18)
\]

Огонь запрещён, если выполняется любое условие:

\[
rangeByte\ge12\quad\lor\quad d\ge range\quad\lor\quad d_{ocs}\ge-0.02
\]
или
\[
(\neg xor\land\neg centered)
\]
или
\[
(rangeByte\ge4\land\neg centered)
\]

Вероятность после gate:

\[
p=chance\cdot
\begin{cases}
1,&score\ge500\\
0.5,&score<500
\end{cases}
\]

Открытие очереди — только на тактическом шаге, при `canFire`, истёкшем `fire` и нулевом `burst`. Для типа 0:

\[
burst=3
\]

Каждый выстрел уменьшает burst на 1; интервал между выстрелами:

\[
burstGap=0.18\text{ s}
\]

После последнего выстрела cooldown:

\[
fire=(0.8+rand\cdot0.25)\cdot DF[dif].fr
\]

Каждый выстрел создаётся из каждого доступного muzzle socket. Если сокетов нет, используется локальная точка \((0,-0.25,-3.8)\). Направление сокета смешивается с направлением на рассчитанную точку упреждения с коэффициентом 0.12. Урон одного снаряда типа 0:

\[
damage=5.0\cdot DF[dif].dm\cdot\frac{2}{\max(1,N_{guns})}
\]

Скорость снаряда — 200; параметр размера/времени в вызове `shootLaser` — 7.0.

## 10. Входящий снаряд

Проверка выполняется только на тактическом шаге. Для каждого снаряда игрока:

\[
\Delta=\mathbf p_{pirate}-\mathbf p_{bullet}
\]

Снаряд считается входящей угрозой, если:

\[
\|\Delta\|<135\quad\land\quad
\mathbf v_{bullet}\cdot\Delta>0
\]

Первое найденное совпадение включает `incoming=true`. В `pirateFleetPhase` оно может запустить jink с вероятностью 0.6, если cooldown завершён.

## 11. Профиль типа 0 в караванном эскорте

Реализация `pcFight` повторяет базовые параметры Головореза:

\[
spd=49,\quad turn=2.05,\quad acc=68
\]

В ATTACK:

\[
spd=\begin{cases}54,&d>260\\43,&d\le260\end{cases}
\]

\[
\mathbf a_1=\operatorname{normalize}
(\mathbf a+0.22s_{slot}\mathbf right_t)
\]
\[
\mathbf a_2=\operatorname{normalize}
(\operatorname{lerp}(\mathbf a_1,\hat{\mathbf t},0.38))
\]

Вне ATTACK скорость равна 50. Далее применяются множители сложности `DF[dif].sp` и `DF[dif].ac`, сглаживание направления `lerp(...,0.4)`, `EAI.command` и `EAI.integrate`.

Ориентация модели эскорта сглаживается функцией `pcOrient`:

\[
q_{target}=q_{lookAt}\,q_{roll}(bank)
\]
\[
q_{new}=slerp(q_{old},q_{target},1-e^{-12dt})
\]

где bank:

\[
bank=\operatorname{clamp}(-0.008\,ocsYaw,-0.2,0.2)
\]

Стрельба эскорта в `pcFire` — отдельная реализация, не тождественная стрельбе стартовой эскадрильи:

- \(v_{shot}=200\), \(t_{lead}=\min(6.2,d/200)\);
- для типа 0: range = 390, cone = 0.82 rad;
- ATTACK и огневое окно проверяются тем же образом;
- burst = 3, интервал = 0.18 s;
- cooldown = \((0.8+rand\cdot0.25)DF[dif].fr\);
- урон = \(5DF[dif].dm\cdot2/N_{guns}\).

В `pcFire` перед `EAI.fireGate` используется `EAI.projectOCS` от вектора на точку упреждения; это именно текущая реализация.

## 12. Псевдокод полного цикла стартового Головореза

```text
каждый кадр:
    если корабль не активен или warp > 0: пропустить

    toPlayer = player.position - ship.position
    distance = length(toPlayer)
    aiThink = EAI.think(ship, dt)

    incoming = false
    если aiThink:
        проверить пули игрока:
            если distance(bullet, ship) < 135
               и dot(bullet.velocity, ship.position - bullet.position) > 0:
                incoming = true
                break

    aim = pirateFleetPhase(ship, toPlayer, distance, incoming, aiThink, dt)

    если phase == ATTACK:
        добавить слотный боковой компонент
        если type == 0:
            aim = normalize(lerp(aim, normalize(toPlayer), 0.38))
            targetSpeed = distance > 260 ? 54 : 43
    иначе:
        targetSpeed = type0 вне ATTACK ? 50

    targetSpeed *= difficulty.speed
    acceleration *= difficulty.acceleration

    если aiThink:
        aimS = normalize(lerp(previousAimS, aim, 0.4))
        EAI.command(ship, aimS, distance, targetSpeed, acceleration, turnRate)

    EAI.integrate(ship, dt)
    обновить ориентацию по velocity и сглаженный bank

    рассчитать leadTime = min(6.2, distance / 200)
    aimPoint = player.position + player.velocity * leadTime
    проверить ATTACK, дальность, огневой конус и EAI.fireGate

    если gate открыт:
        начать очередь из 3 выстрелов
        стрелять с интервалом 0.18 s
        после очереди установить cooldown
```

## 13. Параметры эталонного типа 0 — сводная таблица

| Параметр | Значение в коде | Контекст |
|---|---:|---|
| AI tick | 4/60 s | `EAI.STEP` |
| Порог BREAK | 140 | `PF_BREAK_D[0]` |
| Длительность BREAK | 1.6 s | `PF_BREAK_T[0]` |
| Порог RESET | 400 | `PF_RESET_D[0]` |
| Дополнительный BREAK | phT > 1.2, lz < -0.2, d < 420 | `pirateFleetPhase` |
| Таймаут атаки | 7 s | `pirateFleetPhase` |
| Jink duration | 0.45 s | `pirateFleetPhase` |
| Jink cooldown | 2.2 s | `pirateFleetPhase` |
| Jink probability | 0.6 | при incoming и cooldown=0 |
| Jink lateral | 0.9 | `pirateFleetPhase` |
| Jink vertical | 0.25 | `pirateFleetPhase` |
| Attack speed | 54 / 43 | при d > 260 / иначе |
| Non-attack speed | 50 | массив `[50,59,39,51]` |
| Turn rate | 2.05 | type 0 |
| Acceleration | 68 | type 0 |
| Attack aim lerp | 0.38 | type 0 |
| Aim smoothing | 0.4 | каждый AI tick |
| Slot lateral | 0.22 | стартовая эскадрилья |
| Shot speed | 200 | `pirateFleetUpdate` |
| Lead time cap | 6.2 s | `pirateFleetUpdate` |
| Fire range | 390 | type 0 |
| Fire cone | 0.82 rad | type 0 |
| Close fire cone | 1.3 rad | при d < 260 |
| Burst size | 3 | type 0 |
| Burst interval | 0.18 s | все типы |
| Fire cooldown | 0.8 + rand·0.25 | до difficulty multiplier |
| Base shot damage | 5.0 | до difficulty multiplier и gun normalization |
| Bank limit | ±0.24 rad | стартовая эскадрилья |
| Bank smoothing rate | 5.5 s⁻¹ | экспоненциальное сглаживание |

## 14. Что намеренно не обобщено

- `EAI.chooseVector` — отдельный ATTACK/EVADE-контроллер обычных NPC; он не является фазовым автоматом стартового Головореза `ATTACK/BREAK/RESET`.
- `pcPhase/pcFire` и `pirateFleetPhase/pirateFleetUpdate` похожи, но остаются разными функциями. Это зафиксировано, а не скрыто под одной абстракцией.
- Свободные пираты используют тот же фазовый контроллер, но при патруле имеют отдельные скорости, ускорение, turn rate и отдельный огневой код.
- Параметры сложности `DF[dif].sp/ac/fr/dm` намеренно оставлены ссылками на runtime-множители: их значения задаются таблицей сложности, а не константами данного алгоритма.
- Сокеты GLB влияют на фактическое место и направление выстрела. Математическая модель наведения не заменяет геометрию muzzle sockets.
- Коллизии, damage, HP, respawn, эффекты, выбор модели и транспортное поведение не входят в уравнения пилота.
- Гражданский трафик не использует этот боевой контур. Наличие общей функции движения не следует из текущего кода.

## 15. Контроль соответствия исходнику

Любое изменение эталонного алгоритма должно обновлять эту спецификацию в том же PR. Минимальный регрессионный набор должен проверять:

1. `EAI.think`: 15 Hz при 60 FPS и накопление остатка времени.
2. `EAI.command`: OCS projection, квантование, rangeByte и throttle mapping.
3. `EAI.integrate`: пределы поворота/ускорения и позиционную интеграцию.
4. `pirateFleetPhase`: все переходы ATTACK → BREAK → RESET → ATTACK и jink.
5. Профиль type 0: порог 260, скорости 54/43/50, turn 2.05, acceleration 68, aim lerp 0.38.
6. Огонь: lead cap 6.2, shot speed 200, range 390, cone 0.82, burst 3, gap 0.18.
7. Отдельное соответствие `pcFight/pcFire` и `pirateFleetUpdate` — расхождения не должны исчезать из тестов при рефакторинге.

**Источник истины:** код соответствующих функций в `starfall.html` той же ревизии. При расхождении документа с кодом сначала фиксируется фактическое поведение кода и затем обновляется эта спецификация; формулы не подгоняются под текст.
