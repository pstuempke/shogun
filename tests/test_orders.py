from tests.conftest import make_npc, make_state
from shogun.systems.orders import assign_orders, update_orders
from shogun.core.models import Order
from shogun.core.constants import NpcClass, NPC_CLASS_DATA


def _add_npc(state, npc):
    state.npcs[npc.id] = npc
    state.current_zone.npc_ids.append(npc.id)


def test_assign_orders_max_two():
    npc = make_npc()
    orders = [Order("befriend", "t1"), Order("befriend", "t2"), Order("befriend", "t3")]
    assign_orders(npc, orders)
    assert len(npc.orders) == 2


def test_assign_orders_blocks_attack_player():
    npc = make_npc()
    assign_orders(npc, [Order("attack", "player")])
    assert len(npc.orders) == 0


def test_follower_moves_toward_target():
    follower = make_npc("f0", NpcClass.PEASANT)
    target = make_npc("t0", NpcClass.BANDIT)
    follower.position = (100.0, 100.0)
    target.position = (500.0, 100.0)

    state = make_state()
    follower.is_follower = True
    follower.zone_id = "bridge"
    target.zone_id = "bridge"
    _add_npc(state, follower)
    _add_npc(state, target)

    assign_orders(follower, [Order("befriend", "t0")])
    update_orders(state)

    new_x, _ = follower.position
    assert new_x > 100.0  # moved toward target


def test_follower_befriends_on_contact():
    follower = make_npc("f0", NpcClass.PEASANT)
    target = make_npc("t0", NpcClass.BANDIT)
    follower.position = (400.0, 300.0)
    target.position = (410.0, 300.0)  # within contact distance

    state = make_state()
    follower.is_follower = True
    follower.zone_id = "bridge"
    target.zone_id = "bridge"
    _add_npc(state, follower)
    _add_npc(state, target)

    # force target to be befriendable
    target.energy = 1.0
    assign_orders(follower, [Order("befriend", "t0")])
    update_orders(state)

    assert target.is_follower
    assert follower.orders[0].completed


def test_order_skipped_for_dead_target():
    follower = make_npc("f0")
    target = make_npc("t0")
    target.is_dead = True

    state = make_state()
    follower.is_follower = True
    follower.zone_id = "bridge"
    target.zone_id = "bridge"
    _add_npc(state, follower)
    _add_npc(state, target)

    assign_orders(follower, [Order("befriend", "t0")])
    update_orders(state)
    assert follower.orders[0].completed
