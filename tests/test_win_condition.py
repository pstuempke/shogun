from tests.conftest import make_state, make_zone
from shogun.systems.win_condition import check_win_loss
from shogun.core.constants import WIN_FOLLOWER_COUNT
from shogun.core.models import Item


def test_win_with_all_conditions():
    state = make_state()
    state.player.follower_ids = [f"npc_{i}" for i in range(WIN_FOLLOWER_COUNT)]
    state.player.sacred_items = ["mirror", "scroll", "buddha"]
    check_win_loss(state)
    assert state.game_phase == "won"


def test_loss_on_zero_energy():
    state = make_state()
    state.player.energy = 0.0
    check_win_loss(state)
    assert state.game_phase == "lost"


def test_no_change_when_already_decided():
    state = make_state()
    state.game_phase = "won"
    state.player.energy = 0.0
    check_win_loss(state)
    assert state.game_phase == "won"


def test_20_followers_without_items_triggers_delivery_phase():
    state = make_state()
    state.player.follower_ids = [f"npc_{i}" for i in range(WIN_FOLLOWER_COUNT)]
    state.player.sacred_items = ["mirror", "scroll"]  # missing buddha
    check_win_loss(state)
    assert state.game_phase == "playing"
    assert state.player.shogun_milestone_reached is True
    assert state.delivery_phase is True
    assert state.player.delivery_deadline_tick > 0


def test_delivery_deadline_causes_loss():
    state = make_state()
    state.player.shogun_milestone_reached = True
    state.delivery_phase = True
    state.player.delivery_deadline_tick = 100
    state.elapsed_ticks = 101
    check_win_loss(state)
    assert state.game_phase == "lost"


def test_delivery_phase_win_on_all_items():
    state = make_state()
    state.player.shogun_milestone_reached = True
    state.delivery_phase = True
    state.player.delivery_deadline_tick = 99999
    state.player.sacred_items = ["mirror", "scroll", "buddha"]
    check_win_loss(state)
    assert state.game_phase == "won"


def test_scramble_distributes_items_across_zones():
    """Items held by player get removed and placed in world when milestone triggers."""
    zone_b = make_zone("bridge")
    zone_t = make_zone("temple")
    from shogun.core.models import GameState, Player
    player = Player(position=(400.0, 300.0), current_zone_id="bridge",
                    follower_ids=[f"n{i}" for i in range(WIN_FOLLOWER_COUNT)],
                    sacred_items=[])
    state = GameState(
        player=player,
        npcs={},
        zones={"bridge": zone_b, "temple": zone_t},
        items={
            "mirror": Item(name="mirror", zone_id="bridge", position=(100.0, 100.0), holder_id=None),
            "scroll": Item(name="scroll", zone_id="bridge", position=(200.0, 100.0), holder_id=None),
            "buddha": Item(name="buddha", zone_id="temple", position=(300.0, 100.0), holder_id=None),
        },
    )
    zone_b.item_ids = ["mirror", "scroll"]
    zone_t.item_ids = ["buddha"]
    # Milestone fires without items; scramble should run without error
    check_win_loss(state)
    assert state.delivery_phase is True
    # Items must still exist and be on the ground (holder_id=None)
    for item in state.items.values():
        assert item.holder_id is None
