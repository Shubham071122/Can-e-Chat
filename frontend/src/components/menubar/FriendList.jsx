import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import getTimeStamp from '../time&date/getTimeStamp';

function FriendList() {
  const [friends, setFriends] = useState([]);
  const [lastMsgTime, setLastMsgTime] = useState('');

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const response = await axios.get(
          `${
            import.meta.env.VITE_SERVER_URL
          }/messages/friends-with-last-message`,
          { withCredentials: true },
        );
        if (response.status == 200) {
          setFriends(response.data.data);
        } else {
          setFriends([]);
        }
      } catch (error) {
        console.log('Error while fetching last messages:', error);
        toast.error('Somenting went wrong!');
      }
    };
    fetchFriends();
  }, []);

  return (
    <section className="w-full h-screen bg-gray-100 dark:bg-slate-700 overflow-y-auto">
      <div className="h-auto my-4 flex flex-col justify-center gap-2 px-2 rounded-md">
        {friends.map((friend) => (
          <NavLink
            key={friend.friendId}
            to={`/chat/${friend.friendId}`}
            className={({ isActive }) =>
              `rounded-md ${
                isActive ? 'shadow-md dark:shadow-gray-900' : 'shadow-sm'
              }`
            }
          >
            <div className="px-4 py-3 w-full flex items-start gap-6 border border-gray-400 rounded-md relative">
              <div className="border-[3px] rounded-full w-12 h-12 border-gray-400 dark:border-gray-200 flex items-center justify-center">
                <img
                  src={friend.avatar}
                  alt="avatar"
                  className="w-10 h-10 object-cover object-center rounded-full"
                />
              </div>
              <div>
                <p className="text-black dark:text-gray-200">
                  {friend.fullName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {friend.lastMessage.length > 22
                    ? friend.lastMessage.slice(0, 22) + '...'
                    : friend.lastMessage}
                </p>
              </div>
              <div className='absolute text-xs text-gray-600 dark:text-gray-300 bottom-2 right-2'>
                {friend.lastMessageTime && getTimeStamp(friend.lastMessageTime)}
              </div>
            </div>
          </NavLink>
        ))}
      </div>
    </section>
  );
}

export default FriendList;
