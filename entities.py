import pygame
import random
from constants import *
from sprites import create_tank_surface, create_bullet_surface, create_shield_surface


class Tank(pygame.sprite.Sprite):
    def __init__(self, x, y, color, direction=UP, speed=2, fire_delay=30, tank_type=BASIC_ENEMY):
        super().__init__()
        self.x = x
        self.y = y
        self.color = color
        self.direction = direction
        self.speed = speed
        self.fire_delay = fire_delay
        self.fire_timer = 0
        self.tank_type = tank_type
        self.hp = 1
        self.alive = True

        self.image = create_tank_surface(color, direction)
        self.rect = self.image.get_rect()
        self.rect.topleft = (x, y)

        self.move_dir = direction
        self.is_moving = False

        # Shield (spawn protection)
        self.shield_timer = 0
        self.shield_image = create_shield_surface()
        self.shield_visible = False

        # Invincibility after respawn
        self.invincible_timer = 0

    def set_direction(self, direction):
        if direction != self.direction:
            self.direction = direction
            self.image = create_tank_surface(self.color, direction)
            self.rect = self.image.get_rect(topleft=(self.x, self.y))

    def move(self, dx, dy, walls, tanks):
        """Try to move the tank. Returns True if moved."""
        if not self.alive:
            return False

        new_x = self.x + dx * self.speed
        new_y = self.y + dy * self.speed

        new_x = max(0, min(new_x, PLAY_WIDTH - TANK_SIZE))
        new_y = max(0, min(new_y, PLAY_HEIGHT - TANK_SIZE))

        test_rect = pygame.Rect(new_x, new_y, TANK_SIZE, TANK_SIZE)

        for wall in walls:
            if test_rect.colliderect(wall.rect):
                return False

        for other in tanks:
            if other is not self and other.alive:
                if test_rect.colliderect(other.rect):
                    return False

        self.x = new_x
        self.y = new_y
        self.rect.topleft = (self.x, self.y)
        return True

    def can_shoot(self):
        return self.fire_timer <= 0 and self.alive

    def shoot(self, bullet_group):
        if not self.can_shoot():
            return None

        self.fire_timer = self.fire_delay

        bx = self.x + TANK_SIZE // 2 - 4
        by = self.y + TANK_SIZE // 2 - 4
        bullet = Bullet(bx, by, self.direction, self)
        bullet_group.add(bullet)
        return bullet

    def update(self):
        if not self.alive:
            return

        if self.fire_timer > 0:
            self.fire_timer -= 1

        if self.shield_timer > 0:
            self.shield_timer -= 1
            self.shield_visible = (self.shield_timer // 4) % 2 == 0
        else:
            self.shield_visible = False

        if self.invincible_timer > 0:
            self.invincible_timer -= 1

    def draw_shield(self, screen):
        if self.shield_visible:
            screen.blit(self.shield_image, self.rect)

    def take_damage(self):
        if self.invincible_timer > 0:
            return False
        self.hp -= 1
        if self.hp <= 0:
            self.alive = False
            return True
        return False

    def get_center(self):
        return (self.rect.centerx, self.rect.centery)


class PlayerTank(Tank):
    def __init__(self, x, y):
        super().__init__(x, y, YELLOW, UP, TANK_SPEED, PLAYER_FIRE_DELAY, PLAYER_TANK)
        self.hp = 1
        self.lives = PLAYER_LIVES
        self.score = 0
        self.invincible_timer = PLAYER_INVINCIBLE_FRAMES
        self.shield_timer = 60

    def respawn(self, x, y):
        self.x = x
        self.y = y
        self.rect.topleft = (x, y)
        self.alive = True
        self.hp = 1
        self.direction = UP
        self.image = create_tank_surface(self.color, UP)
        self.invincible_timer = PLAYER_INVINCIBLE_FRAMES
        self.shield_timer = 60
        self.fire_timer = 0


class EnemyTank(Tank):
    def __init__(self, x, y, enemy_type=BASIC_ENEMY):
        config = ENEMY_CONFIG[enemy_type]
        super().__init__(x, y, config["color"], DOWN,
                         config["speed"], config["fire_delay"], enemy_type)
        self.hp = config["hp"]
        self.score_value = config["score"]
        self.move_timer = 0
        self.shoot_chance = 200
        self.ai_timer = 0

    def update_ai(self, walls, tanks, bullet_group):
        if not self.alive:
            return

        self.ai_timer -= 1
        self.move_timer -= 1
        if self.move_timer <= 0:
            self.move_timer = 60 + random.randint(0, 60)
            self._choose_direction(tanks)

        dx, dy = self.direction
        moved = self.move(dx, dy, walls, tanks)
        if not moved:
            self.move_timer = 0

        if random.randint(0, self.shoot_chance) == 0:
            self.shoot(bullet_group)

    def _choose_direction(self, tanks):
        if random.random() < 0.3:
            player = next((t for t in tanks if isinstance(t, PlayerTank) and t.alive), None)
            if player:
                dx = player.x - self.x
                dy = player.y - self.y
                if abs(dx) > abs(dy):
                    self.set_direction(RIGHT if dx > 0 else LEFT)
                else:
                    self.set_direction(DOWN if dy > 0 else UP)
                return

        self.set_direction(random.choice([UP, DOWN, LEFT, RIGHT]))


class Bullet(pygame.sprite.Sprite):
    def __init__(self, x, y, direction, owner):
        super().__init__()
        self.x = x
        self.y = y
        self.direction = direction
        self.owner = owner
        self.speed = BULLET_SPEED
        self.alive = True

        self.image = create_bullet_surface()
        self.rect = self.image.get_rect(topleft=(x, y))

    def update(self, walls, bullet_group, tanks, base):
        if not self.alive:
            return

        dx, dy = self.direction
        self.x += dx * self.speed
        self.y += dy * self.speed

        self.rect.topleft = (self.x, self.y)

        if (self.x < 0 or self.x > PLAY_WIDTH or
                self.y < 0 or self.y > PLAY_HEIGHT):
            self.alive = False
            return

        for wall in walls:
            if self.rect.colliderect(wall.rect):
                wall.hit()
                self.alive = False
                return

        if base and self.rect.colliderect(base.rect):
            base.hit()
            self.alive = False
            return

        for tank in tanks:
            if tank is not self.owner and tank.alive:
                if self.rect.colliderect(tank.rect):
                    tank.take_damage()
                    self.alive = False
                    return


class Wall(pygame.sprite.Sprite):
    def __init__(self, x, y, tile_type):
        super().__init__()
        self.x = x
        self.y = y
        self.tile_type = tile_type
        self.alive = True

        self.update_image()
        self.rect = self.image.get_rect(topleft=(x, y))

    def update_image(self):
        from sprites import create_wall_surface
        self.image = create_wall_surface(self.tile_type)
        if self.rect:
            self.rect.topleft = (self.x, self.y)

    def hit(self):
        if self.tile_type == BRICK:
            self.alive = False
        elif self.tile_type == STEEL:
            pass


class Base(pygame.sprite.Sprite):
    def __init__(self, x, y):
        super().__init__()
        self.x = x
        self.y = y
        self.alive = True
        from sprites import create_base_surface
        self.image = create_base_surface()
        self.rect = self.image.get_rect(topleft=(x, y))

    def hit(self):
        self.alive = False


class Explosion(pygame.sprite.Sprite):
    def __init__(self, x, y):
        super().__init__()
        self.x = x
        self.y = y
        self.frame = 0
        self.max_frames = 8
        from sprites import create_explosion_surface
        self.image = create_explosion_surface(0)
        self.center_x = x + TANK_SIZE // 2
        self.center_y = y + TANK_SIZE // 2
        self.rect = self.image.get_rect(center=(self.center_x, self.center_y))

    def update(self):
        self.frame += 1
        if self.frame >= self.max_frames:
            self.kill()
            return

        from sprites import create_explosion_surface
        self.image = create_explosion_surface(self.frame, self.max_frames)
        self.rect = self.image.get_rect(center=(self.center_x, self.center_y))
