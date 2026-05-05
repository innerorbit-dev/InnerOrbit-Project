/** Purpose: Dynamic route handler for launching stealth/decoy games (Ludo, TicTacToe, etc.). */
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { View } from "react-native";
import LudoGame from "../../components/games/LudoGame";
import TicTacToeGame from "../../components/games/TicTacToeGame";
import GuessTheNumberGame from "../../components/games/GuessTheNumberGame";
import { useEffect } from "react";

const GameScreen = () => {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  // Render the correct game component based on the route ID
  const renderGame = () => {
    switch (id) {
      case "ludo":
        return <LudoGame />;
      case "tic-tac-toe":
        return <TicTacToeGame />;
      case "guess-the-number":
        return <GuessTheNumberGame />;
      default:
        return <View style={{ flex: 1, backgroundColor: '#000' }} />;
    }
  };

  // Redirect if invalid ID
  useEffect(() => {
    if (id && !['ludo', 'tic-tac-toe', 'guess-the-number'].includes(id)) {
      router.replace('/CalcX');
    }
  }, [id]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          contentStyle: { backgroundColor: '#000000' }
        }}
      />
      {renderGame()}
    </>
  );
};

export default GameScreen;
