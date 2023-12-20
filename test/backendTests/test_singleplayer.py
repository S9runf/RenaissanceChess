import random
import chess
from django.test import TestCase
from channels.testing import WebsocketCommunicator
from api.consumers import GameConsumer
from reconchess import chess

class TestSingleplayer(TestCase):
	async def connect(self):
		communicator = WebsocketCommunicator(GameConsumer.as_asgi(), "/ws/game")
		connected, _ = await communicator.connect()
		self.assertTrue(connected)
		return communicator
	
	async def test_pass(self):
		communicator = await self.connect()
		await communicator.send_json_to({
			'action': 'start_game'
		})

		response = await communicator.receive_json_from()
		self.assertEqual(response['color'], 'white')
		self.assertEqual(response['board'], chess.STARTING_FEN)

		response = await communicator.receive_json_from()
		self.assertTrue(response['message'] == 'your turn to sense')

		await communicator.send_json_to(({'action': 'pass'}))
		response = await communicator.receive_json_from()

		self.assertEqual(response['message'], 'move result')
		self.assertEqual(response['requested_move'], 'None')

		await communicator.disconnect()
	
	async def test_timeout(self):
		communicator = await self.connect()
		await communicator.send_json_to({
			'action': 'start_game',
			'seconds': 3
		})

		response = await communicator.receive_json_from()
		self.assertEqual(response['color'], 'white')
		self.assertEqual(response['board'], chess.STARTING_FEN)

		response = await communicator.receive_json_from()
		self.assertTrue(response['message'] == 'your turn to sense')
	

		response = await communicator.receive_json_from(timeout=5)
		self.assertEqual(response['message'], 'game over')

		await communicator.disconnect()

	async def test_full_game(self):
		communicator = await self.connect()
		await communicator.send_json_to({
			'action': 'start_game'
		})
		response = await communicator.receive_json_from()
		self.assertEqual(response['color'], 'white')
		self.assertEqual(response['board'], chess.STARTING_FEN)

		response = await communicator.receive_json_from()

		print('simulating game please wait')
		#simulate a game between a human player and a bot
		#the human chooses legal moves ranodmly
		while True:
			self.assertTrue(response['message'] == 'your turn to sense' or response['message'] == 'opponent move')
			if(response['message'] == 'opponent move'):
				response = await communicator.receive_json_from()
				self.assertEqual(response['message'], 'your turn to sense')	
				
			sense = random.choice(chess.SQUARE_NAMES)
			await communicator.send_json_to(({'action': 'sense', 'sense': sense}))

			response = await communicator.receive_json_from()
			self.assertEqual(response['message'], 'your turn to move')
			move = random.choice(response['move_actions'])
			await communicator.send_json_to(({'action': 'move', 'move': move}))

			response = await communicator.receive_json_from()
			self.assertEqual(response['message'], 'move result')

			response = await communicator.receive_json_from()
			self.assertEqual(response['message'], 'turn ended')

			response = await communicator.receive_json_from()
			self.assertTrue(response['message'] == 'opponent move' or response['message'] == 'game over')

			self.assertIn('message', response)
			if response['message'] == 'game over':
				break


		await communicator.disconnect()
	

