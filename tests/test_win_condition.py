from tests.conftest import make_state
from shogun.systems.win_condition import check_win_loss
from shogun.core.constants import WIN_FOLLOWER_COUNT


def test_win_requires_followers_and_items():
    state = make_state()
    state.player.follower_ids = [f"npc_{i}" for i in range(WIN_FOLLOWER_COUNT)]
    state.player.sacred_items = ["mirror", "scroll"]  # missing buddha
    check_win_loss(state)
    assert state.game_phase == "playing"


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
    state.player.energy = 0.0  # would normally trigger loss
    check_win_loss(state)
    assert state.game_phase == "won"  # already decided, no change
