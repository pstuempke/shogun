from __future__ import annotations
from shogun.core.models import GameState, NPC, Order
from shogun.core.constants import ORDER_CONTACT_DISTANCE


def _dist(ax: float, ay: float, bx: float, by: float) -> float:
    return ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5


def assign_orders(npc: NPC, orders: list[Order]) -> None:
    """Assign up to 2 orders to a follower. Silently enforces the 2-order limit."""
    safe = [o for o in orders if not (o.action == "attack" and o.target_id == "player")]
    npc.orders = safe[:2]


def update_orders(state: GameState) -> None:
    """Each tick: move followers toward their targets and execute orders on contact."""
    for npc in state.npcs.values():
        if npc.is_dead or not npc.is_follower:
            continue
        for order in npc.pending_orders:
            _execute_order(state, npc, order)


def _execute_order(state: GameState, follower: NPC, order: Order) -> None:
    target = state.npcs.get(order.target_id)
    if target is None or target.is_dead:
        order.completed = True
        return

    # followers only act within the same zone
    if follower.zone_id != target.zone_id:
        return

    fx, fy = follower.position
    tx, ty = target.position
    dist = _dist(fx, fy, tx, ty)

    if dist > ORDER_CONTACT_DISTANCE:
        # move toward target
        step = follower.speed / dist
        follower.position = (fx + (tx - fx) * step, fy + (ty - fy) * step)
        return

    # on contact — execute
    if order.action == "befriend":
        from shogun.systems.social import follower_befriend
        success = follower_befriend(state, follower, target)
        if success or target.is_follower:
            order.completed = True
    elif order.action == "attack":
        # guard: never attack the player
        if order.target_id == "player":
            order.completed = True
            return
        from shogun.systems.combat import _npc_vs_npc
        follower.combat_target = target.id
        _npc_vs_npc(state, follower)
        if target.is_dead or target.energy <= 0:
            order.completed = True
