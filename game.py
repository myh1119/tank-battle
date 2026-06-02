import pygame
import sys
import random
from constants import *
from entities import PlayerTank, EnemyTank, Bullet, Wall, Base, Explosion
from map_data import get_level


class Game:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("坦克大战 - Tank Battle")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont("simhei", 24)
        self.large_font = pygame.font.SysFont("simhei", 48)
        self.title_font = pygame.font.SysFont("simhei", 64)
        self.small_font = pygame.font.SysFont("simhei", 18)

        self.running = True
        self.state = TITLE
        self.frame_count = 0

        self.level_num = 1
        self.player = None
        self.enemies = pygame.sprite.Group()
        self.bullets = pygame.sprite.Group()
        self.walls = pygame.sprite.Group()
        self.base = None
        self.explosions = pygame.sprite.Group()

        self.enemy_queue = []
        self.max_active_enemies = 2
        self.active_enemy_count = 0
        self.enemy_spawn_timer = 0
        self.enemy_spawn_points = [(0, 0), (304, 0), (608, 0)]
        self.player_spawn = (TILE_SIZE, (ROWS - 1) * TILE_SIZE)

        self.player_respawn_timer = 0

    def run(self):
        while self.running:
            self.clock.tick(FPS)
            self.frame_count += 1

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        if self.state == PLAYING:
                            self.state = TITLE
                        else:
                            self.running = False

            if self.state == TITLE:
                self._update_title()
            elif self.state == PLAYING:
                self._update_playing()
            elif self.state == GAME_OVER:
                self._update_game_over()
            elif self.state == LEVEL_COMPLETE:
                self._update_level_complete()

            pygame.display.flip()

        pygame.quit()
        sys.exit()

    def _start_new_game(self):
        self.level_num = 1
        self._init_level()

    def _init_level(self):
        self.walls.empty()
        self.enemies.empty()
        self.bullets.empty()
        self.explosions.empty()
        self.base = None
        self.active_enemy_count = 0
        self.player_respawn_timer = 0

        level_data = get_level(self.level_num)
        self.max_active_enemies = level_data["max_active_enemies"]
        self.enemy_queue = list(reversed(level_data["enemies"]))

        grid = level_data["map"]
        for row in range(ROWS):
            for col in range(COLS):
                tile = grid[row][col]
                if tile == EMPTY:
                    continue
                x = col * TILE_SIZE
                y = row * TILE_SIZE
                if tile == BASE:
                    self.base = Base(x, y)
                    self.walls.add(self.base)
                else:
                    self.walls.add(Wall(x, y, tile))

        # Auto-add brick walls around base if map doesn't have them
        base_y = (ROWS - 2) * TILE_SIZE
        has_base_walls = any(
            w.y >= base_y and hasattr(w, 'tile_type')
            for w in self.walls if w is not self.base
        )
        if not has_base_walls:
            base_col = COLS // 2 - 1
            base_row = ROWS - 2
            for dc, dr in [(-1, -1), (0, -1), (1, -1),
                           (-1, 0), (-1, 1), (1, 0), (1, 1)]:
                c, r = base_col + dc, base_row + dr
                if 0 <= c < COLS and 0 <= r < ROWS:
                    self.walls.add(Wall(c * TILE_SIZE, r * TILE_SIZE, BRICK))

        x, y = self.player_spawn
        self.player = PlayerTank(x, y)
        self.enemy_spawn_timer = 60

    def _spawn_enemy(self):
        if not self.enemy_queue or self.active_enemy_count >= self.max_active_enemies:
            return

        available = []
        for sx, sy in self.enemy_spawn_points:
            spawn_rect = pygame.Rect(sx, sy, TANK_SIZE, TANK_SIZE)
            blocked = any(
                t.alive and spawn_rect.colliderect(t.rect)
                for t in ([self.player] + list(self.enemies)) if t
            )
            blocked = blocked or any(
                spawn_rect.colliderect(w.rect)
                for w in self.walls if w.alive
            )
            if not blocked:
                available.append((sx, sy))

        if not available:
            return

        spawn = random.choice(available)
        enemy_type = self.enemy_queue.pop()
        enemy = EnemyTank(spawn[0], spawn[1], enemy_type)
        enemy.shield_timer = 60
        self.enemies.add(enemy)
        self.active_enemy_count += 1

    def _get_obstacles(self):
        return [w for w in self.walls if w.alive]

    def _update_title(self):
        self.screen.fill(BLACK)

        title = self.title_font.render("坦 克 大 战", True, YELLOW)
        subtitle = self.large_font.render("TANK BATTLE", True, WHITE)
        self.screen.blit(title, (SCREEN_WIDTH // 2 - title.get_width() // 2, 100))
        self.screen.blit(subtitle, (SCREEN_WIDTH // 2 - subtitle.get_width() // 2, 170))

        lines = [
            "↑ ↓ ← →  : 移 动",
            "SPACE / J : 射 击",
            "",
            "ENTER : 开 始 游 戏",
        ]
        for i, text in enumerate(lines):
            if not text:
                continue
            surf = self.font.render(text, True, WHITE)
            self.screen.blit(surf, (SCREEN_WIDTH // 2 - surf.get_width() // 2, 260 + i * 35))

        if (self.frame_count // 30) % 2 == 0:
            start = self.font.render("按 ENTER 开始游戏", True, CYAN)
            self.screen.blit(start, (SCREEN_WIDTH // 2 - start.get_width() // 2, 480))

        keys = pygame.key.get_pressed()
        if keys[pygame.K_RETURN]:
            pygame.time.wait(200)
            self.state = PLAYING
            self._start_new_game()

    def _update_playing(self):
        if self.player_respawn_timer > 0:
            self.player_respawn_timer -= 1
            if self.player_respawn_timer == 0:
                self.player = PlayerTank(*self.player_spawn)
            self._draw_play()
            return

        keys = pygame.key.get_pressed()

        if self.player and self.player.alive:
            obstacles = self._get_obstacles()
            all_tanks = [self.player] + list(self.enemies)

            if keys[pygame.K_UP] or keys[pygame.K_w]:
                self.player.set_direction(UP)
                self.player.move(0, -1, obstacles, all_tanks)
            elif keys[pygame.K_DOWN] or keys[pygame.K_s]:
                self.player.set_direction(DOWN)
                self.player.move(0, 1, obstacles, all_tanks)
            elif keys[pygame.K_LEFT] or keys[pygame.K_a]:
                self.player.set_direction(LEFT)
                self.player.move(-1, 0, obstacles, all_tanks)
            elif keys[pygame.K_RIGHT] or keys[pygame.K_d]:
                self.player.set_direction(RIGHT)
                self.player.move(1, 0, obstacles, all_tanks)

            if keys[pygame.K_SPACE] or keys[pygame.K_j]:
                self.player.shoot(self.bullets)

        if self.player:
            self.player.update()

        obstacles = self._get_obstacles()
        for enemy in list(self.enemies):
            if enemy.alive:
                all_tanks = ([self.player] if self.player else []) + list(self.enemies)
                enemy.update_ai(obstacles, all_tanks, self.bullets)

        # Bullet movement & collision
        for bullet in list(self.bullets):
            if not bullet.alive:
                self.bullets.remove(bullet)
                continue

            dx, dy = bullet.direction
            bullet.x += dx * bullet.speed
            bullet.y += dy * bullet.speed
            bullet.rect.topleft = (bullet.x, bullet.y)

            if (bullet.x < 0 or bullet.x > PLAY_WIDTH or
                    bullet.y < 0 or bullet.y > PLAY_HEIGHT):
                bullet.alive = False
                self.bullets.remove(bullet)
                continue

            hit = False
            for wall in list(self.walls):
                if wall.alive and bullet.rect.colliderect(wall.rect):
                    if hasattr(wall, 'hit'):
                        wall.hit()
                    if not wall.alive:
                        self.walls.remove(wall)
                    hit = True
                    break
            if hit:
                bullet.alive = False
                self.bullets.remove(bullet)
                continue

            if self.base and self.base.alive and bullet.rect.colliderect(self.base.rect):
                self.base.alive = False
                self.walls.remove(self.base)
                bullet.alive = False
                self.bullets.remove(bullet)
                self.explosions.add(Explosion(self.base.x, self.base.y))
                continue

            all_tanks = ([self.player] if self.player else []) + list(self.enemies)
            for tank in all_tanks:
                if tank is bullet.owner or not tank.alive:
                    continue
                if bullet.rect.colliderect(tank.rect):
                    died = tank.take_damage()
                    bullet.alive = False
                    self.bullets.remove(bullet)
                    if died:
                        self.explosions.add(Explosion(tank.x, tank.y))
                        if tank == self.player:
                            self.player.lives -= 1
                            self.player = None
                            if self.player.lives > 0:
                                self.player_respawn_timer = 90
                        else:
                            if self.player:
                                self.player.score += tank.score_value
                            self.enemies.remove(tank)
                            self.active_enemy_count -= 1
                    break

        self.enemy_spawn_timer -= 1
        if self.enemy_spawn_timer <= 0:
            self._spawn_enemy()
            self.enemy_spawn_timer = 120 - min(90, (self.level_num - 1) * 15)

        self.explosions.update()

        if self.base and not self.base.alive:
            self.state = GAME_OVER
            return

        if self.player is None and self.player_respawn_timer <= 0:
            self.state = GAME_OVER
            return

        if not self.enemy_queue and self.active_enemy_count <= 0:
            self.state = LEVEL_COMPLETE
            return

        self._draw_play()

    def _draw_play(self):
        self.screen.fill(BLACK)

        pygame.draw.rect(self.screen, DARK_GRAY, (0, 0, PLAY_WIDTH, PLAY_HEIGHT))

        for x in range(0, PLAY_WIDTH + 1, TILE_SIZE):
            pygame.draw.line(self.screen, (48, 48, 48), (x, 0), (x, PLAY_HEIGHT), 1)
        for y in range(0, PLAY_HEIGHT + 1, TILE_SIZE):
            pygame.draw.line(self.screen, (48, 48, 48), (0, y), (PLAY_WIDTH, y), 1)

        for wall in self.walls:
            if wall.alive:
                if not hasattr(wall, 'tile_type') or wall.tile_type != BASE:
                    self.screen.blit(wall.image, wall.rect)

        if self.base and self.base.alive:
            self.screen.blit(self.base.image, self.base.rect)

        if self.player and self.player.alive:
            self.screen.blit(self.player.image, self.player.rect)
            self.player.draw_shield(self.screen)

        for enemy in self.enemies:
            if enemy.alive:
                self.screen.blit(enemy.image, enemy.rect)
                enemy.draw_shield(self.screen)

        for bullet in self.bullets:
            if bullet.alive:
                self.screen.blit(bullet.image, bullet.rect)

        for explosion in self.explosions:
            self.screen.blit(explosion.image, explosion.rect)

        self._draw_panel()

        pygame.draw.line(self.screen, WHITE, (0, 0), (PLAY_WIDTH, 0), 2)
        pygame.draw.line(self.screen, WHITE, (0, 0), (0, PLAY_HEIGHT), 2)
        pygame.draw.line(self.screen, WHITE, (PLAY_WIDTH - 1, 0), (PLAY_WIDTH - 1, PLAY_HEIGHT), 2)
        pygame.draw.line(self.screen, WHITE, (0, PLAY_HEIGHT - 1), (PLAY_WIDTH, PLAY_HEIGHT - 1), 2)

        if self.player_respawn_timer > 0:
            text = self.font.render(f"RESPAWN IN {(self.player_respawn_timer // 15) + 1}", True, YELLOW)
            self.screen.blit(text, (PLAY_WIDTH // 2 - text.get_width() // 2, PLAY_HEIGHT // 2))

    def _draw_panel(self):
        px = PANEL_X + 10
        pygame.draw.rect(self.screen, BLACK, (PANEL_X, 0, PANEL_WIDTH, SCREEN_HEIGHT))

        texts = [
            (self.font.render("STAGE", True, WHITE), (px, 20)),
            (self.font.render(str(self.level_num), True, CYAN), (px + 20, 50)),
            (self.font.render("SCORE", True, WHITE), (px, 100)),
            (self.small_font.render(f"{self.player.score if self.player else 0}", True, YELLOW), (px + 10, 130)),
            (self.font.render("LIVES", True, WHITE), (px, 200)),
            (self.small_font.render(f"{self.player.lives if self.player else 0}", True, GREEN), (px + 10, 230)),
            (self.font.render("ENEMIES", True, WHITE), (px, 300)),
        ]
        for surf, pos in texts:
            self.screen.blit(surf, pos)

        remaining = len(self.enemy_queue) + self.active_enemy_count
        for i in range(min(remaining, 20)):
            ex = px + (i % 2) * 30
            ey = 340 + (i // 2) * 25
            pygame.draw.rect(self.screen, RED, (ex, ey, 20, 20), 2)

        hint = self.small_font.render("ESC=退出", True, GRAY)
        self.screen.blit(hint, (px, SCREEN_HEIGHT - 40))

    def _update_game_over(self):
        self.screen.fill(BLACK)
        over = self.large_font.render("GAME OVER", True, RED)
        self.screen.blit(over, (SCREEN_WIDTH // 2 - over.get_width() // 2, 200))

        score = self.font.render(
            f"FINAL SCORE: {self.player.score if self.player else 0}", True, WHITE)
        self.screen.blit(score, (SCREEN_WIDTH // 2 - score.get_width() // 2, 280))

        if (self.frame_count // 30) % 2 == 0:
            restart = self.font.render("ENTER = 重新开始  ESC = 退出", True, CYAN)
            self.screen.blit(restart, (SCREEN_WIDTH // 2 - restart.get_width() // 2, 380))

        keys = pygame.key.get_pressed()
        if keys[pygame.K_RETURN]:
            pygame.time.wait(200)
            self.state = TITLE

    def _update_level_complete(self):
        self.screen.fill(BLACK)
        complete = self.large_font.render(f"STAGE {self.level_num} CLEAR!", True, GREEN)
        self.screen.blit(complete, (SCREEN_WIDTH // 2 - complete.get_width() // 2, 200))

        score = self.font.render(
            f"SCORE: {self.player.score if self.player else 0}", True, WHITE)
        self.screen.blit(score, (SCREEN_WIDTH // 2 - score.get_width() // 2, 280))

        if (self.frame_count // 30) % 2 == 0:
            next_text = self.font.render("ENTER = 下一关", True, CYAN)
            self.screen.blit(next_text, (SCREEN_WIDTH // 2 - next_text.get_width() // 2, 380))

        keys = pygame.key.get_pressed()
        if keys[pygame.K_RETURN]:
            pygame.time.wait(200)
            self.level_num += 1
            self.state = PLAYING
            self._init_level()
