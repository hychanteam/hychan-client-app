// Function to format time remaining
export const formatTimeRemaining = (endTime: number) => {
    const now = Math.floor(Date.now() / 1000)
    const timeRemaining = endTime - now
  
    if (timeRemaining <= 0) return "Ended"
  
    const hours = Math.floor(timeRemaining / 3600)
    const minutes = Math.floor((timeRemaining % 3600) / 60)
    const seconds = timeRemaining % 60
  
    return `${hours}h ${minutes}m ${seconds}s`
  }
  
  