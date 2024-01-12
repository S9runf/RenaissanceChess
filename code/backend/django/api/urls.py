from django.contrib import admin
from django.urls import path
from . import views

urlpatterns = [
	
	#displays admin page
	path('admin/', admin.site.urls),

	#allows user to register, returns plaintext messages indicating success or failure	
	path('register/', views.register, name='register'),

	#use django's built in authenication system
	path('login/', views.userLogin, name='login'),

	path('logout/', views.userLogout, name='logout'),

	path('check_login/', views.checkLogin, name='check_login'),
 
	#google id token verification
	path('googleID/', views.googleID, name='googleID'),
    
	path('player_loc_stats/<str:player_name>/', views.player_loc_stats, name='player_loc_stats'),

	path('player_username/<str:mail>/', views.player_username, name='player_username'),
    
	path('leaderboard/', views.leaderboard, name='leaderboard'),

	path('rooms/<str:room_name>/', views.search_room, name='rooms')
]
